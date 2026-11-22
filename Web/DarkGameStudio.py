import random
import os
from pathlib import Path

VIDEO_DIR = "/path/to/dark_game_studio/videos"

def get_all_videos():
    """获取视频池"""
    return [str(p) for p in Path(VIDEO_DIR).glob("*.mp4")]

def pick_video_with_random_duration(video_pool):
    """
    随机选择视频，并随机截取时长（防止整段循环被识别）
    返回 (文件路径, 推流时长秒数)
    """
    chosen = random.choice(video_pool)
    # 随机截取 3 小时 ~ 5 小时之间的长度（以秒计）
    min_sec = 3 * 3600
    max_sec = 5 * 3600
    duration = random.randint(min_sec, max_sec)
    return chosen, duration

def build_rotating_ffmpeg(video_file, duration_sec):
    """带时长限制的推流命令（截取指定秒数后自动断流，由守护进程接管下一个视频）"""
    return [
        "ffmpeg",
        "-re",
        "-i", video_file,
        "-t", str(duration_sec),      # 只推 duration_sec 秒
        "-c", "copy",
        "-f", "flv",
        "-loglevel", "quiet",
        f"{BILI_RTMP_URL}{BILI_STREAM_KEY}"
    ]