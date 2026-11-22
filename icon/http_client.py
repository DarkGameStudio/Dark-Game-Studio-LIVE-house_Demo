# http_client.py
import time
import random
import logging
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

log = logging.getLogger(__name__)

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 "
    "(KHTML, like Gecko) Version/17.4 Safari/605.1.15",
]


class HttpClient:
    """带重试、限速、随机 UA 的会话封装"""

    def __init__(self, min_interval=1.0, max_interval=2.5):
        self.session = requests.Session()
        retry = Retry(
            total=3,
            backoff_factor=1.5,
            status_forcelist=[429, 500, 502, 503, 504],
            allowed_methods=["GET"],
        )
        adapter = HTTPAdapter(max_retries=retry, pool_maxsize=4)
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

    def get(self, url, **kwargs):
        self._throttle()
        headers = kwargs.pop("headers", {})
        headers.setdefault("User-Agent", random.choice(USER_AGENTS))
        headers.setdefault("Accept-Language", "zh-CN,zh;q=0.9,en;q=0.8")
        try:
            resp = self.session.get(url, headers=headers, timeout=20, **kwargs)
            resp.raise_for_status()
            return resp
        except requests.RequestException as e:
            log.warning(f"请求失败 {url}: {e}")
            return None