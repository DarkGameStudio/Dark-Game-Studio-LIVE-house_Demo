# crawler.py
import json
import logging
import argparse
from pathlib import Path
from datetime import datetime

from http_client import HttpClient
from sources.steam import SteamCrawler
from sources.itch import ItchCrawler
from sources.nintendo import NintendoCrawler
from sources.playstation import PlayStationCrawler

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("crawler")

OUTPUT_DIR = Path("./output")
OUTPUT_DIR.mkdir(exist_ok=True)


CRAWLER_MAP = {
    "steam": SteamCrawler,
    "itch": ItchCrawler,
    "nintendo": NintendoCrawler,
    "playstation": PlayStationCrawler,
}


def run(sources, keyword, limit, enrich=True):
    client = HttpClient(min_interval=1.0, max_interval=2.5)
    all_games = []
    for name in sources:
        cls = CRAWLER_MAP.get(name)
        if not cls:
            log.warning(f"未知源：{name}")
            continue
        log.info(f"===== 开始抓取 {name}：{keyword} =====")
        try:
            crawler = cls(client)
            if name == "itch":
                games = crawler.crawl(keyword, limit=limit, enrich=enrich)
            else:
                games = crawler.crawl(keyword, limit=limit)
            all_games.extend(games)
            log.info(f"[{name}] 完成，共 {len(games)} 条")
        except Exception as e:
            log.exception(f"[{name}] 抓取异常：{e}")

    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    out_file = OUTPUT_DIR / f"games_{keyword}_{ts}.json"
    out_file.write_text(
        json.dumps([g.to_dict() for g in all_games], ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    log.info(f"✅ 共 {len(all_games)} 条，已保存：{out_file}")
    return out_file


def main():
    p = argparse.ArgumentParser(description="多源游戏信息聚合爬虫")
    p.add_argument("-k", "--keyword", required=True, help="搜索关键词")
    p.add_argument("-s", "--sources", default="steam,itch,nintendo,playstation",
                   help="逗号分隔：steam,itch,nintendo,playstation")
    p.add_argument("-n", "--limit", type=int, default=20, help="每源条数上限")
    p.add_argument("--no-enrich", action="store_true", help="itch 不进入详情页")
    args = p.parse_args()

    run(
        sources=[s.strip() for s in args.sources.split(",") if s.strip()],
        keyword=args.keyword,
        limit=args.limit,
        enrich=not args.no_enrich,
    )


if __name__ == "__main__":
    main()