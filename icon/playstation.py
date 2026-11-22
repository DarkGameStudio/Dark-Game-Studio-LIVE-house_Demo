# sources/playstation.py
import json
import re
import logging
from bs4 import BeautifulSoup
from models import Game

log = logging.getLogger(__name__)
PS_SEARCH = "https://store.playstation.com/en-us/search/"


class PlayStationCrawler:
    def __init__(self, client):
        self.client = client

    def _extract_next_data(self, html):
        """提取 Next.js 的 __NEXT_DATA__ JSON"""
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

    def _walk_concepts(self, node, out):
        """递归遍历 NEXT_DATA，收集 concept（即游戏）节点"""
        if isinstance(node, dict):
            if node.get("__typename") == "Concept" and "name" in node:
                out.append(node)
            for v in node.values():
                self._walk_concepts(v, out)
        elif isinstance(node, list):
            for v in node:
                self._walk_concepts(v, out)

    def crawl(self, keyword, limit=20):
        resp = self.client.get(PS_SEARCH, params={"q": keyword})
        if not resp:
            return []
        data = self._extract_next_data(resp.text)
        if not data:
            log.warning("[playstation] 未找到 __NEXT_DATA__，页面结构可能已变")
            return []

        concepts = []
        self._walk_concepts(data, concepts)

        games = []
        for c in concepts[:limit]:
            price = None
            try:
                price = c["price"]["price"]["basePrice"]
            except (KeyError, TypeError):
                pass
            games.append(Game(
                source="playstation",
                source_id=c.get("id", ""),
                title=c.get("name", ""),
                url=f"https://store.playstation.com/en-us/concept/{c.get('id','')}",
                description=(c.get("description") or "")[:600],
                price=price,
                currency="USD",
                platforms=[p.get("value") for p in (c.get("platforms") or []) if isinstance(p, dict)],
                publisher=(c.get("publisherName") or None),
                cover_image=(((c.get("media") or [{}])[0]).get("url")),
                tags=[g.get("value") for g in (c.get("genres") or []) if isinstance(g, dict)],
            ))
            log.info(f"[playstation] {games[-1].title}")
        return games