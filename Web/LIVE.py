#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Dark Game Studio · 24h 元宇宙/区块链/Web3 科普直播间（单文件版）

用法：
  python3 metaverse_live.py init      # 生成音频、卡片、片段（一次性/增量）
  python3 metaverse_live.py stream    # 启动 24h 推流守护
  python3 metaverse_live.py danmaku   # 启动弹幕互动机器人
  python3 metaverse_live.py all       # 后台同时启动 stream + danmaku（需 nohup）

依赖：
  sudo apt install -y ffmpeg fonts-noto-cjk
  pip install edge-tts pillow requests websocket-client
"""

import os
import sys
import json
import time
import random
import asyncio
import logging
import argparse
import subprocess
import textwrap
import threading
from pathlib import Path

# ============================================================
# 0. 全局配置（按需修改）
# ============================================================
BASE_DIR       = Path("/path/to/metaverse_live")
KNOWLEDGE_JSON = BASE_DIR / "knowledge.json"
AUDIO_DIR      = BASE_DIR / "audio"
CARD_DIR       = BASE_DIR / "cards"
SEGMENT_DIR    = BASE_DIR / "segments"
BG_DIR         = BASE_DIR / "backgrounds"

for d in (AUDIO_DIR, CARD_DIR, SEGMENT_DIR, BG_DIR):
    d.mkdir(parents=True, exist_ok=True)

# B 站推流地址（从 live.bilibili.com 直播中心获取，约 7 天过期）
RTMP_URL   = "rtmp://live-push.bilivideo.com/live-bvc/"
STREAM_KEY = "?streamname=live_xxxxx_xxxxx&key=xxxxxxxx&schedule=rtmp&pflag=1"

# 弹幕机器人配置
ROOM_ID = 12345678
COOKIE  = "SESSDATA=xxxx; bili_jct=xxxx; buvid3=xxxx"
CSRF    = "xxxx"           # 即 bili_jct 的值

# 视觉
W, H = 1920, 1080
FONT_TITLE = "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc"
FONT_BODY  = "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"
BRAND = "Dark Game Studio · 元宇宙科普"
TTS_VOICE = "zh-CN-YunxiNeural"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("metaverse")


# ============================================================
# 1. 知识点库（内嵌默认数据；若 knowledge.json 存在则优先加载）
# ============================================================
DEFAULT_KNOWLEDGE = [
    {
        "id": "btc_001", "category": "比特币", "title": "什么是比特币？",
        "script": "比特币是2009年由化名中本聪的人或团队创造的一种去中心化数字货币。"
                  "它不依赖任何中央银行发行，而是通过全球无数台计算机共同维护一个公开账本——"
                  "区块链，来记录每一笔转账。比特币总量上限为2100万枚，这种稀缺性设计使它"
                  "常被称为数字黄金。",
        "keywords": ["去中心化", "中本聪", "2100万", "数字黄金"],
    },
    {
        "id": "web3_001", "category": "Web3.0", "title": "Web3.0 和 Web2.0 有什么区别？",
        "script": "Web2.0 时代，你的数据、社交关系、创作内容都存储在科技公司的服务器上，"
                  "平台拥有最终控制权。Web3.0 则试图把所有权交还给用户：通过区块链和加密钱包，"
                  "你的身份、资产和创作记录由你自己掌握，应用之间可以互操作，无需信任某个中心化平台。",
        "keywords": ["所有权", "加密钱包", "互操作", "去信任"],
    },
    {
        "id": "meta_001", "category": "元宇宙", "title": "元宇宙到底是什么？",
        "script": "元宇宙并不是某一个具体的产品，而是一个持久的、三维的、多人共享的虚拟空间集合。"
                  "它融合了虚拟现实、数字孪生、区块链身份和实时渲染技术。你可以把它理解为一个"
                  "始终在线、可以与现实世界平行运行的数字世界，人们在其中社交、工作、娱乐和交易。",
        "keywords": ["三维虚拟空间", "数字孪生", "实时渲染", "平行世界"],
    },
    {
        "id": "chain_001", "category": "区块链", "title": "区块链为什么难以篡改？",
        "script": "区块链把交易按时间顺序打包成一个个区块，每个区块都包含前一个区块的哈希值，"
                  "形成首尾相连的链条。任何人想修改历史记录，就必须重新计算该区块之后所有区块的"
                  "哈希，并控制网络中超过半数的算力，成本极高，因此区块链具有极强的防篡改特性。",
        "keywords": ["哈希", "链式结构", "51%攻击", "防篡改"],
    },
]


def load_knowledge():
    if KNOWLEDGE_JSON.exists():
        try:
            data = json.loads(KNOWLEDGE_JSON.read_text(encoding="utf-8"))
            log.info(f"已加载 {len(data)} 条知识点：{KNOWLEDGE_JSON}")
            return data
        except Exception as e:
            log.warning(f"解析 knowledge.json 失败，使用内置数据：{e}")
    else:
        KNOWLEDGE_JSON.write_text(
            json.dumps(DEFAULT_KNOWLEDGE, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        log.info(f"已写入默认知识点：{KNOWLEDGE_JSON}")
    return DEFAULT_KNOWLEDGE


# ============================================================
# 2. 阶段一：TTS 语音合成
# ============================================================
async def _tts_one(text: str, out_path: str):
    import edge_tts
    communicate = edge_tts.Communicate(text, TTS_VOICE, rate="+0%")
    await communicate.save(out_path)


async def _tts_all(knowledge):
    for item in knowledge:
        out = AUDIO_DIR / f"{item['id']}.mp3"
        if out.exists():
            continue
        try:
            await _tts_one(item["script"], str(out))
            log.info(f"🎙 音频生成：{item['id']}")
        except Exception as e:
            log.error(f"TTS 失败 {item['id']}: {e}")


def build_audio(knowledge):
    log.info("=== 阶段 1：生成 TTS 语音 ===")
    asyncio.run(_tts_all(knowledge))


# ============================================================
# 3. 阶段二：视觉标题卡
# ============================================================
def make_title_card(item, out_path: Path):
    from PIL import Image, ImageDraw, ImageFont

    img = Image.new("RGB", (W, H), (10, 12, 20))
    bgs = list(BG_DIR.glob("*.jpg")) + list(BG_DIR.glob("*.png"))
    if bgs:
        try:
            bg = Image.open(random.choice(bgs)).convert("RGB").resize((W, H))
            img.paste(bg, (0, 0))
            overlay = Image.new("RGBA", (W, H), (0, 0, 0, 140))
            img = Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")
        except Exception:
            pass

    draw = ImageDraw.Draw(img)
    f_brand = ImageFont.truetype(FONT_BODY, 40)
    f_cat   = ImageFont.truetype(FONT_TITLE, 48)
    f_title = ImageFont.truetype(FONT_TITLE, 96)
    f_kw    = ImageFont.truetype(FONT_BODY, 44)

    draw.rectangle([0, 0, W, 100], fill=(20, 24, 40))
    draw.text((60, 28), BRAND, font=f_brand, fill=(180, 200, 255))
    draw.text((60, 180), f"【{item['category']}】", font=f_cat, fill=(255, 200, 80))

    y = 280
    for line in textwrap.wrap(item["title"], width=18):
        draw.text((60, y), line, font=f_title, fill=(255, 255, 255))
        y += 130

    x = 60
    for kw in item["keywords"]:
        bbox = draw.textbbox((0, 0), kw, font=f_kw)
        w = bbox[2] - bbox[0] + 40
        draw.rounded_rectangle([x, 780, x + w, 850], radius=16, fill=(40, 60, 110))
        draw.text((x + 20, 790), kw, font=f_kw, fill=(220, 230, 255))
        x += w + 20

    img.save(out_path)


def build_cards(knowledge):
    log.info("=== 阶段 2：生成标题卡 ===")
    for item in knowledge:
        out = CARD_DIR / f"{item['id']}.png"
        if out.exists():
            continue
        make_title_card(item, out)
        log.info(f"🖼 卡片生成：{item['id']}")


# ============================================================
# 4. 阶段三：合成 MP4 片段
# ============================================================
def _probe_duration(media_path: str) -> float:
    r = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=nw=1:nk=1", media_path],
        capture_output=True, text=True,
    )
    try:
        return float(r.stdout.strip())
    except ValueError:
        return 0.0


def compose_segment(card: Path, audio: Path, out: Path):
    dur = _probe_duration(str(audio)) + 1.5
    cmd = [
        "ffmpeg", "-y", "-loglevel", "error",
        "-loop", "1", "-i", str(card),
        "-i", str(audio),
        "-t", f"{dur:.2f}",
        "-vf", "scale=2200:-1,zoompan=z='min(zoom+0.0003,1.15)':d=1:s=1920x1080:fps=25",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "128k",
        "-shortest",
        str(out),
    ]
    subprocess.run(cmd, check=True)


def build_segments(knowledge):
    log.info("=== 阶段 3：合成 MP4 片段 ===")
    for item in knowledge:
        card  = CARD_DIR  / f"{item['id']}.png"
        audio = AUDIO_DIR / f"{item['id']}.mp3"
        out   = SEGMENT_DIR / f"{item['id']}.mp4"
        if out.exists() or not card.exists() or not audio.exists():
            continue
        try:
            compose_segment(card, audio, out)
            log.info(f"🎬 片段合成：{item['id']}")
        except subprocess.CalledProcessError as e:
            log.error(f"合成失败 {item['id']}: {e}")


def cmd_init():
    knowledge = load_knowledge()
    build_audio(knowledge)
    build_cards(knowledge)
    build_segments(knowledge)
    total = len(list(SEGMENT_DIR.glob("*.mp4")))
    log.info(f"✅ 初始化完成，内容池共 {total} 个片段")


# ============================================================
# 5. 阶段四：推流调度守护
# ============================================================
def _shuffled_pool():
    files = sorted(str(p) for p in SEGMENT_DIR.glob("*.mp4"))
    if not files:
        return []
    random.shuffle(files)
    return files


def _stream_one(file_path: str):
    cmd = [
        "ffmpeg", "-re",
        "-i", file_path,
        "-c", "copy",
        "-f", "flv",
        "-loglevel", "quiet",
        f"{RTMP_URL}{STREAM_KEY}",
    ]
    return subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def stream_loop():
    log.info("=== 推流守护启动（Ctrl+C 停止） ===")
    while True:
        pool = _shuffled_pool()
        if not pool:
            log.error("内容池为空，30 秒后重试。请先执行 init。")
            time.sleep(30)
            continue
        for seg in pool:
            log.info(f"▶ 推流：{Path(seg).name}")
            proc = _stream_one(seg)
            try:
                proc.wait()
            except KeyboardInterrupt:
                proc.terminate()
                raise
            # 片段间隔 3–8 秒随机静默，避免固定节奏
            time.sleep(random.uniform(3, 8))
        log.info("🔁 一轮播放结束，重新洗牌")


# ============================================================
# 6. 阶段五：弹幕互动机器人（基于 blivedm 更稳健）
# ============================================================
REPLY_MAP = {
    "比特币": "比特币总量 2100 万枚，通过工作量证明挖矿产生，详见直播间科普卡片~",
    "web3":  "Web3.0 强调用户拥有数据和资产所有权，欢迎继续观看讲解！",
    "元宇宙": "元宇宙是持久在线的三维虚拟空间集合，融合 VR、数字孪生与区块链身份。",
    "区块链": "区块链是分布式账本，每个节点保存完整副本，篡改需控制多数节点。",
}
_last_reply_ts = 0.0
_REPLY_INTERVAL = 15.0     # B 站安全间隔，切勿调小


def _send_danmaku(msg: str):
    import requests
    try:
        requests.post(
            "https://api.live.bilibili.com/msg/send",
            data={
                "bubble": "0", "msg": msg, "color": "16777215",
                "mode": "1", "fontsize": "25",
                "rnd": str(int(time.time())),
                "roomid": ROOM_ID, "csrf": CSRF, "csrf_token": CSRF,
            },
            headers={
                "Cookie": COOKIE,
                "Referer": f"https://live.bilibili.com/{ROOM_ID}",
                "User-Agent": "Mozilla/5.0",
            },
            timeout=10,
        )
    except Exception as e:
        log.warning(f"发送弹幕失败：{e}")


def danmaku_bot():
    """使用 blivedm 库监听弹幕；pip install blivedm"""
    log.info("=== 弹幕机器人启动 ===")
    try:
        from blivedm import BLiveClient
        from blivedm.models.web import DanmakuMessage
    except ImportError:
        log.error("缺少 blivedm，请执行：pip install blivedm")
        return

    global _last_reply_ts

    class Client(BLiveClient):
        async def _on_danmaku(self, client, message: DanmakuMessage):
            global _last_reply_ts
            text = (message.msg or "").lower()
            for kw, reply in REPLY_MAP.items():
                if kw in text:
                    if time.time() - _last_reply_ts >= _REPLY_INTERVAL:
                        _send_danmaku(reply)
                        _last_reply_ts = time.time()
                    break

    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    client = Client(ROOM_ID, sessdata=COOKIE.split("SESSDATA=")[-1].split(";")[0])

    async def runner():
        await client.start()

    try:
        loop.run_until_complete(runner())
    except KeyboardInterrupt:
        log.info("弹幕机器人退出")


# ============================================================
# 7. CLI 入口
# ============================================================
def cmd_all():
    """后台同时启动推流与弹幕线程（适合本地常驻）"""
    t1 = threading.Thread(target=stream_loop, name="stream", daemon=True)
    t2 = threading.Thread(target=danmaku_bot, name="danmaku", daemon=True)
    t1.start(); t2.start()
    try:
        while True:
            time.sleep(3600)
    except KeyboardInterrupt:
        log.info("全部退出")


def main():
    parser = argparse.ArgumentParser(description="元宇宙科普 24h 直播间")
    parser.add_argument(
        "action",
        choices=["init", "stream", "danmaku", "all"],
        help="init=生成内容池；stream=推流；danmaku=弹幕机器人；all=两者同时",
    )
    args = parser.parse_args()

    if args.action == "init":
        cmd_init()
    elif args.action == "stream":
        stream_loop()
    elif args.action == "danmaku":
        danmaku_bot()
    elif args.action == "all":
        cmd_all()


if __name__ == "__main__":
    main()