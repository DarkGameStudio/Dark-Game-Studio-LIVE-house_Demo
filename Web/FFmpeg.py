import subprocess
import time
import os
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# 从 B 站直播中心获取（密钥会过期，建议定期手动或半自动更新）
BILI_RTMP_URL = "rtmp://live-push.bilivideo.com/live-bvc/"
BILI_STREAM_KEY = "?streamname=live_xxxxx_xxxxx&key=xxxxxxxx&schedule=rtmp&pflag=1"

# 视频素材目录
VIDEO_DIR = "/path/to/dark_game_studio/videos"

def build_ffmpeg_command(video_file):
    """构建单文件推流命令（循环模式，配合后续防重复策略使用）"""
    return [
        "ffmpeg",
        "-re",                       # 按视频原始速率读取，模拟实时
        "-stream_loop", "-1",        # 无限循环
        "-i", video_file,
        "-c", "copy",                # 不重新编码，节省 CPU（要求素材已是 H.264 + AAC）
        "-f", "flv",
        "-loglevel", "quiet",
        f"{BILI_RTMP_URL}{BILI_STREAM_KEY}"
    ]

def stream_guard(video_file):
    """守护进程：推流断开自动重连"""
    while True:
        cmd = build_ffmpeg_command(video_file)
        logging.info(f"▶ 开始推流：{video_file}")
        process = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        process.wait()
        logging.warning(f"⚠ 推流中断（返回码 {process.returncode}），10 秒后重连...")
        time.sleep(10)

if __name__ == "__main__":
    # 初始选择一个文件（后续由防重复调度器传入不同文件）
    sample_video = os.path.join(VIDEO_DIR, "gameplay_01.mp4")
    stream_guard(sample_video)