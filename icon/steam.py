# sources/steam.py
import logging
from models import Game

log = logging.getLogger(__name__)
STEAM_SEARCH = "https://store.steampowered.com/api/storesearch/"
STEAM_DETAIL = "https://store.steampowered.com/api/appdetails"


class SteamCrawler:
    def __init__(self, client):
        self.client = client

    def search(self, keyword, limit=20):
        """按关键词搜索，返回 appid 列表"""
        resp = self.client.get(
            STEAM_SEARCH,
            params={"term": keyword, "l": "schinese", "cc": "cn"},
        )
        if not resp:
            return []
        data = resp.json()
        return [item["id"] for item in data.get("items", [])[:limit]]

    def detail(self, appid):
        """获取单个游戏详情"""
        resp = self.client.get(
            STEAM_DETAIL,
            params={"appids": appid, "l": "schinese", "cc": "cn"},
        )
        if not resp:
            return None
        payload = resp.json().get(str(appid), {})
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

        return Game(
            source="steam",
            source_id=str(appid),
            title=d.get("name", ""),
            url=f"https://store.steampowered.com/app/{appid}/",
            description=_strip_html(d.get("short_description", "")),
            price=price or ("Free" if d.get("is_free") else None),
            currency=currency,
            release_date=(d.get("release_date") or {}).get("date"),
            tags=[g["description"] for g in d.get("genres", [])],
            genres=[g["description"] for g in d.get("genres", [])],
            platforms=[k for k in ("windows", "mac", "linux") if d.get("platforms", {}).get(k)],
            developer=", ".join(d.get("developers", [])),
            publisher=", ".join(d.get("publishers", [])),
            cover_image=d.get("header_image"),
            rating=d.get("metacritic", {}).get("score") if d.get("metacritic") else None,
        )

    def crawl(self, keyword, limit=20):
        results = []
        for appid in self.search(keyword, limit):
            game = self.detail(appid)
            if game:
                results.append(game)
                log.info(f"[steam] {game.title}")
        return results


def _strip_html(text):
    import re
    return re.sub(r"<[^>]+>", "", text).strip()