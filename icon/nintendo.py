# sources/nintendo.py
import json
import logging
import re
from bs4 import BeautifulSoup
from models import Game

log = logging.getLogger(__name__)
NINTENDO_SEARCH = "https://www.nintendo.com/us/search/"
ALGOLIA_HINT = "https://u5m1nt3u4a-dsn.algolia.net/1/indexes/*/queries"


class NintendoCrawler:
    """
    任天堂商店前端使用 Algolia 搜索。
    直接抓 Algolia 接口最稳定（公开的 search-only key 在前端 JS 中）。
    若密钥失效，退化为解析搜索页 HTML。
    """

    ALGOLIA_APP_ID = "U5M1NT3U4A"
    ALGOLIA_API_KEY = "9c4f7b3c1e0e4b0f7f2c1f8d9c1a2b3c"  # 示例，实际从站点 JS 获取

    def __init__(self, client):
        self.client = client

    def _via_algolia(self, keyword, limit):
        body = {
            "requests": [{
                "indexName": "ncom_game_en_us",
                "query": keyword,
                "hitsPerPage": limit,
            }]
        }
        resp = self.client.session.post(
            ALGOLIA_HINT,
            params={"x-algolia-application-id": self.ALGOLIA_APP_ID,
                    "x-algolia-api-key": self.ALGOLIA_API_KEY},
            json=body, timeout=20,
        )
        if resp.status_code != 200:
            return []
        hits = resp.json()["results"][0].get("hits", [])
        games = []
        for h in hits:
            games.append(Game(
                source="nintendo",
                source_id=h.get("objectID") or h.get("slug", ""),
                title=h.get("title", ""),
                url=f"https://www.nintendo.com/us/store/products/{h.get('slug','')}/",
                description=h.get("description", "")[:600],
                price=h.get("price", {}).get("finalPrice") if isinstance(h.get("price"), dict) else None,
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

    def _via_html(self, keyword, limit):
        resp = self.client.get(NINTENDO_SEARCH, params={"q": keyword})
        if not resp:
            return []
        soup = BeautifulSoup(resp.text, "html.parser")
        games = []
        for card in soup.select("a[href*='/store/products/']")[:limit]:
            games.append(Game(
                source="nintendo",
                source_id=card["href"].rstrip("/").split("/")[-1],
                title=card.get_text(strip=True) or "Unknown",
                url="https://www.nintendo.com" + card["href"] if card["href"].startswith("/") else card["href"],
                platforms=["switch"],
            ))
        return games

    def crawl(self, keyword, limit=20):
        games = self._via_algolia(keyword, limit)
        if not games:
            log.info("[nintendo] Algolia 失败，回退 HTML 解析")
            games = self._via_html(keyword, limit)
        for g in games:
            log.info(f"[nintendo] {g.title}")
        return games