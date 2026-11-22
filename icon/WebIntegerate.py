#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
多源游戏信息聚合爬虫（单文件版）
支持源：steam / itch / nintendo / playstation

用法：
  python3 game_crawler.py -k "metaverse" -n 30
  python3 game_crawler.py -k "cyberpunk" -s steam,itch
  python3 game_crawler.py -k "zelda" -s nintendo --render     # 用 Playwright 兜底
  python3 game_crawler.py -k "final fantasy" -o ./out --pretty

依赖：
  pip install requests beautifulsoup4 lxml
  可选：pip install playwright && playwright install chromium  # --render 时使用
"""

import os
import re
import sys
import json
import time
import random
import logging
import argparse
import subprocess
from pathlib import Path
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from bs4 import BeautifulSoup

# ============================================================
# 0. 日志
# ============================================================
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("game_crawler")


# ============================================================
# 1. 统一数据模型
# ============================================================
@dataclass
class Game:
    source: str
    source_id: str
    title: str
    url: str
    description: str = ""
    price: Optional[str] = None
    currency: Optional[str] = None
    release_date: Optional[str] = None
    tags: List[str] = field(default_factory=list)
    genres: List[str] = field(default_factory=list)
    platforms: List[str] = field(default_factory=list)
    developer: Optional[str] = None
    publisher: Optional[str] = None
    cover_image: Optional[str] = None
    rating: Optional[float] = None
    fetched_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


def strip_html(text: str) -> str:
    return re.sub(r"<[^>]+>", "", text or "").strip()


# ============================================================
# 2. HTTP 客户端：限速 + 重试 + 随机 UA
# ============================================================
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 "
    "(KHTML, like Gecko) Version/17.4 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
]


class HttpClient:
    def __init__(self, min_interval: float = 1.0, max_interval: float = 2.5):
        self.session = requests.Session()
        retry = Retry(
            total=3,
            backoff_factor=1.5,
            status_forcelist=[429, 500, 502, 503, 504],
            allowed_methods=["GET", "POST"],
        )
        adapter = HTTPAdapter(max_retries=retry, pool_maxsize=6)
        self.session.mount("https://", adapter)
        self.session.mount("http://", adapter)
        self.min_interval = min_interval
        self.max_interval = max_interval
        self._last = 0.0

    def _throttle(self):
        wait = random.uniform(self.min_interval, self.max_interval)
        elapsed = time.time() - self._last
        if elapsed < wait:
            time.sleep(wait - elapsed)
        self._last = time.time()

    def _headers(self, extra: Optional[Dict[str, str]] = None) -> Dict[str, str]:
        h = {
            "User-Agent": random.choice(USER_AGENTS),
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
            "Accept": "text/html,application/json,application/xhtml+xml,*/*;q=0.8",
        }
        if extra:
            h.update(extra)
        return h

    def get(self, url: str, **kwargs) -> Optional[requests.Response]:
        self._throttle()
        headers = self._headers(kwargs.pop("headers", {}))
        try:
            resp = self.session.get(url, headers=headers, timeout=20, **kwargs)
            resp.raise_for_status()
            return resp
        except requests.RequestException as e:
            log.warning(f"GET 失败 {url}: {e}")
            return None

    def post(self, url: str, **kwargs) -> Optional[requests.Response]:
        self._throttle()
        headers = self._headers(kwargs.pop("headers", {}))
        try:
            resp = self.session.post(url, headers=headers, timeout=20, **kwargs)
            resp.raise_for_status()
            return resp
        except requests.RequestException as e:
            log.warning(f"POST 失败 {url}: {e}")
            return None


# ============================================================
# 3. Playwright 渲染兜底（惰性导入）
# ============================================================
class Renderer:
    def __init__(self):
        self._available = False
        try:
            import playwright  # noqa: F401
            self._available = True
        except ImportError:
            log.warning("未安装 playwright，--render 将退化为普通请求")

    def render(self, url: str, wait_selector: Optional[str] = None,
               timeout: int = 30000) -> Optional[str]:
        if not self._available:
            return None
        from playwright.sync_api import sync_playwright
        try:
            with sync_playwright() as p:
                browser = p.chromium.launch(headless=True)
                page = browser.new_page(user_agent=random.choice(USER_AGENTS))
                page.goto(url, timeout=timeout)
                if wait_selector:
                    page.wait_for_selector(wait_selector, timeout=timeout)
                else:
                    page.wait_for_timeout(2000)
                html = page.content()
                browser.close()
                return html
        except Exception as e:
            log.warning(f"渲染失败 {url}: {e}")
            return None


# ============================================================
# 4. Steam 源：官方 Store API
# ============================================================
class SteamCrawler:
    SEARCH = "https://store.steampowered.com/api/storesearch/"
    DETAIL = "https://store.steampowered.com/api/appdetails"

    def __init__(self, client: HttpClient, renderer: Renderer):
        self.client = client
        self.renderer = renderer

    def search(self, keyword: str, limit: int) -> List[int]:
        resp = self.client.get(
            self.SEARCH,
            params={"term": keyword, "l": "schinese", "cc": "cn"},
        )
        if not resp:
            return []
        try:
            data = resp.json()
        except ValueError:
            return []
        return [item["id"] for item in data.get("items", [])[:limit]]

    def detail(self, appid: int) -> Optional[Game]:
        resp = self.client.get(
            self.DETAIL,
            params={"appids": appid, "l": "schinese", "cc": "cn"},
        )
        if not resp:
            return None
        try:
            payload = resp.json().get(str(appid), {})
        except ValueError:
            return None
        if not payload.get("success"):
            return None
        d = payload["data"]

        price = None
        currency = None
        if not d.get("is_free"):
            po = d.get("price_overview")
            if po:
                price = f"{po['final'] / 100:.2f}"
                currency = po.get("currency")

        platforms = [k for k in ("windows", "mac", "linux")
                     if d.get("platforms", {}).get(k)]

        return Game(
            source="steam",
            source_id=str(appid),
            title=d.get("name", ""),
            url=f"https://store.steampowered.com/app/{appid}/",
            description=strip_html(d.get("short_description", "")),
            price=price or ("Free" if d.get("is_free") else None),
            currency=currency,
            release_date=(d.get("release_date") or {}).get("date"),
            tags=[g["description"] for g in d.get("genres", [])],
            genres=[g["description"] for g in d.get("genres", [])],
            platforms=platforms,
            developer=", ".join(d.get("developers", [])),
            publisher=", ".join(d.get("publishers", [])),
            cover_image=d.get("header_image"),
            rating=(d.get("metacritic") or {}).get("score"),
        )

    def crawl(self, keyword: str, limit: int) -> List[Game]:
        results = []
        for appid in self.search(keyword, limit):
            game = self.detail(appid)
            if game:
                results.append(game)
                log.info(f"[steam] {game.title}")
        return results


# ============================================================
# 5. itch.io 源：HTML 解析
# ============================================================
class ItchCrawler:
    SEARCH = "https://itch.io/search"

    def __init__(self, client: HttpClient, renderer: Renderer):
        self.client = client
        self.renderer = renderer

    def search(self, keyword: str, limit: int) -> List[Game]:
        resp = self.client.get(self.SEARCH, params={"q": keyword})
        if not resp:
            return []
        soup = BeautifulSoup(resp.text, "html.parser")
        games = []
        for cell in soup.select("div.game_cell")[:limit]:
            a = cell.select_one("a.title")
            if not a:
                continue
            title = a.get_text(strip=True)
            url = a.get("href", "")
            cover = cell.select_one("img")
            price = cell.select_one("div.price_value")
            author = cell.select_one("div.game_author a")
            games.append(Game(
                source="itch",
                source_id=url.rstrip("/").split("/")[-1] if url else title,
                title=title,
                url=url,
                price=price.get_text(strip=True) if price else None,
                developer=author.get_text(strip=True) if author else None,
                cover_image=(cover.get("data-lazy_src") or cover.get("src")) if cover else None,
                tags=[t.get_text(strip=True) for t in cell.select("div.game_genre")],
            ))
        return games

    def detail(self, url: str) -> Dict[str, Any]:
        resp = self.client.get(url)
        if not resp:
            return {}
        soup = BeautifulSoup(resp.text, "html.parser")

        desc_el = soup.select_one("div.formatted_description")
        desc = desc_el.get_text(" ", strip=True) if desc_el else ""

        platforms = []
        for icon in soup.select("div.game_platforms .icon"):
            cls = " ".join(icon.get("class", []))
            for p in ("windows", "osx", "linux", "android"):
                if p in cls:
                    platforms.append(p)

        tags = [t.get_text(strip=True) for t in soup.select("div.game_tags a.tag")]
        return {"description": desc[:600], "platforms": platforms, "tags": tags}

    def crawl(self, keyword: str, limit: int, enrich: bool = True) -> List[Game]:
        games = self.search(keyword, limit)
        if enrich:
            for g in games:
                extra = self.detail(g.url)
                if extra:
                    g.description = extra.get("description", "")
                    g.platforms = extra.get("platforms", [])
                    g.tags = extra.get("tags") or g.tags
                log.info(f"[itch] {g.title}")
        else:
            for g in games:
                log.info(f"[itch] {g.title}")
        return games


# ============================================================
# 6. Nintendo 源：Algolia → HTML 回退 → 可选渲染
# ============================================================
class NintendoCrawler:
    SEARCH = "https://www.nintendo.com/us/search/"
    ALGOLIA_URL = "https://u5m1nt3u4a-dsn.algolia.net/1/indexes/*/queries"
    ALGOLIA_APP_ID = "U5M1NT3U4A"
    ALGOLIA_KEY = "9c4f7b3c1e0e4b0f7f2c1f8d9c1a2b3c"  # 示例，可能失效

    def __init__(self, client: HttpClient, renderer: Renderer):
        self.client = client
        self.renderer = renderer

    def _via_algolia(self, keyword: str, limit: int) -> List[Game]:
        body = {
            "requests": [{
                "indexName": "ncom_game_en_us",
                "query": keyword,
                "hitsPerPage": limit,
            }]
        }
        resp = self.client.post(
            self.ALGOLIA_URL,
            params={
                "x-algolia-application-id": self.ALGOLIA_APP_ID,
                "x-algolia-api-key": self.ALGOLIA_KEY,
            },
            json=body,
        )
        if not resp:
            return []
        try:
            hits = resp.json()["results"][0].get("hits", [])
        except (ValueError, KeyError, IndexError):
            return []

        games = []
        for h in hits:
            slug = h.get("slug") or h.get("objectID", "")
            price_obj = h.get("price")
            price = (price_obj.get("finalPrice")
                     if isinstance(price_obj, dict) else None)
            games.append(Game(
                source="nintendo",
                source_id=h.get("objectID") or slug,
                title=h.get("title", ""),
                url=f"https://www.nintendo.com/us/store/products/{slug}/" if slug else "",
                description=(h.get("description") or "")[:600],
                price=price,
                currency="USD",
                release_date=h.get("releaseDate"),
                tags=h.get("genres", []),
                genres=h.get("genres", []),
                platforms=["switch"],
                publisher=h.get("publisher"),
                cover_image=h.get("productImage"),
                rating=h.get("reviewScore"),
            ))
        return games

    def _via_html(self, keyword: str, limit: int, use_render: bool = False) -> List[Game]:
        html = None
        if use_render:
            url = f"{self.SEARCH}?q={keyword}"
            html = self.renderer.render(url, wait_selector="a[href*='/store/products/']")
        if not html:
            resp = self.client.get(self.SEARCH, params={"q": keyword})
            html = resp.text if resp else None
        if not html:
            return []

        soup = BeautifulSoup(html, "html.parser")
        games = []
        seen = set()
        for card in soup.select("a[href*='/store/products/']"):
            href = card.get("href", "")
            if not href or href in seen:
                continue
            seen.add(href)
            title = card.get_text(strip=True) or "Unknown"
            full_url = ("https://www.nintendo.com" + href
                        if href.startswith("/") else href)
            games.append(Game(
                source="nintendo",
                source_id=href.rstrip("/").split("/")[-1],
                title=title,
                url=full_url,
                platforms=["switch"],
            ))
            if len(games) >= limit:
                break
        return games

    def crawl(self, keyword: str, limit: int, use_render: bool = False) -> List[Game]:
        games = self._via_algolia(keyword, limit)
        if not games:
            log.info("[nintendo] Algolia 失败，回退 HTML/渲染")
            games = self._via_html(keyword, limit, use_render)
        for g in games:
            log.info(f"[nintendo] {g.title}")
        return games


# ============================================================
# 7. PlayStation 源：解析 __NEXT_DATA__
# ============================================================
class PlayStationCrawler:
    SEARCH = "https://store.playstation.com/en-us/search/"

    def __init__(self, client: HttpClient, renderer: Renderer):
        self.client = client
        self.renderer = renderer

    def _extract_next_data(self, html: str) -> Optional[Dict[str, Any]]:
        m = re.search(
            r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>',
            html, re.S,
        )
        if not m:
            return None
        try:
            return json.loads(m.group(1))
        except json.JSONDecodeError:
            return None

    def _walk_concepts(self, node: Any, out: List[Dict[str, Any]]):
        if isinstance(node, dict):
            if node.get("__typename") == "Concept" and "name" in node:
                out.append(node)
            for v in node.values():
                self._walk_concepts(v, out)
        elif isinstance(node, list):
            for v in node:
                self._walk_concepts(v, out)

    def crawl(self, keyword: str, limit: int, use_render: bool = False) -> List[Game]:
        html = None
        url = f"{self.SEARCH}?q={keyword}"
        if use_render:
            html = self.renderer.render(url, wait_selector="a[href*='/concept/']")
        if not html:
            resp = self.client.get(self.SEARCH, params={"q": keyword})
            html = resp.text if resp else None
        if not html:
            return []

        data = self._extract_next_data(html)
        if not data:
            log.warning("[playstation] 未找到 __NEXT_DATA__，结构可能已变")
            return []

        concepts: List[Dict[str, Any]] = []
        self._walk_concepts(data, concepts)

        games = []
        for c in concepts[:limit]:
            price = None
            try:
                price = c["price"]["price"]["basePrice"]
            except (KeyError, TypeError):
                pass
            media = c.get("media") or [{}]
            cover = media[0].get("url") if isinstance(media[0], dict) else None
            games.append(Game(
                source="playstation",
                source_id=c.get("id", ""),
                title=c.get("name", ""),
                url=f"https://store.playstation.com/en-us/concept/{c.get('id','')}",
                description=(c.get("description") or "")[:600],
                price=price,
                currency="USD",
                platforms=[p.get("value") for p in (c.get("platforms") or [])
                           if isinstance(p, dict)],
                publisher=c.get("publisherName"),
                cover_image=cover,
                tags=[g.get("value") for g in (c.get("genres") or [])
                      if isinstance(g, dict)],
            ))
            log.info(f"[playstation] {games[-1].title}")
        return games


# ============================================================
# 8. 调度器
# ============================================================
CRAWLER_MAP = {
    "steam": SteamCrawler,
    "itch": ItchCrawler,
    "nintendo": NintendoCrawler,
    "playstation": PlayStationCrawler,
}


def run(sources: List[str], keyword: str, limit: int,
        enrich: bool = True, use_render: bool = False) -> Path:
    client = HttpClient(min_interval=1.0, max_interval=2.5)
    renderer = Renderer()
    all_games: List[Game] = []

    for name in sources:
        cls = CRAWLER_MAP.get(name)
        if not cls:
            log.warning(f"未知源：{name}")
            continue
        log.info(f"===== {name} 抓取：{keyword} =====")
        try:
            crawler = cls(client, renderer)
            if name == "itch":
                games = crawler.crawl(keyword, limit=limit, enrich=enrich)
            elif name in ("nintendo", "playstation"):
                games = crawler.crawl(keyword, limit=limit, use_render=use_render)
            else:
                games = crawler.crawl(keyword, limit=limit)
            all_games.extend(games)
            log.info(f"[{name}] 完成：{len(games)} 条")
        except Exception as e:
            log.exception(f"[{name}] 异常：{e}")

    out_file = OUTPUT_DIR / f"games_{_safe_name(keyword)}_{_ts()}.json"
    out_file.write_text(
        json.dumps([g.to_dict() for g in all_games],
                   ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    log.info(f"✅ 共 {len(all_games)} 条 → {out_file}")
    return out_file


# ============================================================
# 9. 工具函数
# ============================================================
def _safe_name(s: str) -> str:
    return re.sub(r"[^\w\-]+", "_", s)[:60] or "result"


def _ts() -> str:
    return datetime.now().strftime("%Y%m%d_%H%M%S")


def games_to_knowledge(games: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """把爬取结果转成直播间知识点结构"""
    out = []
    for g in games:
        desc = (g.get("description") or "")[:120]
        price = g.get("price") or "未知"
        platforms = "、".join(g.get("platforms") or []) or "未知"
        out.append({
            "id": f"{g['source']}_{g['source_id']}",
            "category": f"游戏·{g['source']}",
            "title": g["title"],
            "script": (
                f"{g['title']} 是 {g.get('developer') or '未知开发者'} 的作品。"
                f"{desc}。售价 {price}，支持平台：{platforms}。"
            ),
            "keywords": (g.get("tags") or [])[:4]
                        + ([g["release_date"]] if g.get("release_date") else []),
        })
    return out


# ============================================================
# 10. CLI
# ============================================================
OUTPUT_DIR = Path("./output")
OUTPUT_DIR.mkdir(exist_ok=True)


def main():
    p = argparse.ArgumentParser(description="多源游戏信息聚合爬虫（单文件）")
    p.add_argument("-k", "--keyword", required=True, help="搜索关键词")
    p.add_argument("-s", "--sources", default="steam,itch,nintendo,playstation",
                   help="逗号分隔：steam,itch,nintendo,playstation")
    p.add_argument("-n", "--limit", type=int, default=20, help="每源条数上限")
    p.add_argument("-o", "--out-dir", default="./output", help="输出目录")
    p.add_argument("--no-enrich", action="store_true",
                   help="itch 不进入详情页（更快）")
    p.add_argument("--render", action="store_true",
                   help="Nintendo/PS 使用 Playwright 渲染兜底")
    p.add_argument("--to-knowledge", action="store_true",
                   help="额外输出直播间知识点格式 knowledge_*.json")
    p.add_argument("--pretty", action="store_true", help="打印结果到 stdout")
    args = p.parse_args()

    global OUTPUT_DIR
    OUTPUT_DIR = Path(args.out_dir)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    out_file = run(
        sources=[s.strip() for s in args.sources.split(",") if s.strip()],
        keyword=args.keyword,
        limit=args.limit,
        enrich=not args.no_enrich,
        use_render=args.render,
    )

    if args.to_knowledge or args.pretty:
        data = json.loads(out_file.read_text(encoding="utf-8"))

        if args.to_knowledge:
            kn = games_to_knowledge(data)
            kn_file = OUTPUT_DIR / f"knowledge_{_safe_name(args.keyword)}_{_ts()}.json"
            kn_file.write_text(
                json.dumps(kn, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
            log.info(f"📚 知识点输出：{kn_file}")

        if args.pretty:
            print(json.dumps(data, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        log.info("用户中断")
        sys.exit(130)