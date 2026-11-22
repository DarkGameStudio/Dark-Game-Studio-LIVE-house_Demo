# sources/itch.py
import re
import json
import logging
from bs4 import BeautifulSoup
from models import Game

log = logging.getLogger(__name__)
ITCH_SEARCH = "https://itch.io/search"


class ItchCrawler:
    def __init__(self, client):
        self.client = client

    def search(self, keyword, limit=20):
        resp = self.client.get(ITCH_SEARCH, params={"q": keyword})
        if not resp:
            return []
        soup = BeautifulSoup(resp.text, "html.parser")
        games = []
        for cell in soup.select("div.game_cell")[:limit]:
            a = cell.select_one("a.title")
            if not a:
                continue
            title = a.get_text(strip=True)
            url = a.get("href")
            cover = cell.select_one("img")
            price = cell.select_one("div.price_value")
            author = cell.select_one("div.game_author a")

            games.append(Game(
                source="itch",
                source_id=url.rstrip("/").split("/")[-1],
                title=title,
                url=url,
                price=price.get_text(strip=True) if price else None,
                developer=author.get_text(strip=True) if author else None,
                cover_image=cover.get("data-lazy_src") or cover.get("src") if cover else None,
                tags=[t.get_text(strip=True) for t in cell.select("div.game_genre")],
                platforms=[],
            ))
        return games

    def detail(self, url):
        """进入详情页补全描述、平台标签"""
        resp = self.client.get(url)
        if not resp:
            return None
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

        return {
            "description": desc[:600],
            "platforms": platforms,
            "tags": tags,
        }

    def crawl(self, keyword, limit=20, enrich=True):
        games = self.search(keyword, limit)
        if enrich:
            for g in games:
                extra = self.detail(g.url)
                if extra:
                    g.description = extra["description"]
                    g.platforms = extra["platforms"]
                    g.tags = extra["tags"] or g.tags
                log.info(f"[itch] {g.title}")
        return games