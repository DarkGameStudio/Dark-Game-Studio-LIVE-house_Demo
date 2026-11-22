# models.py
from dataclasses import dataclass, field, asdict
from typing import List, Optional
from datetime import datetime


@dataclass
class Game:
    source: str                      # steam / itch / nintendo / playstation
    source_id: str                   # 平台内唯一 ID
    title: str
    url: str
    description: str = ""
    price: Optional[str] = None      # "¥58" / "$9.99" / "Free"
    currency: Optional[str] = None
    release_date: Optional[str] = None
    tags: List[str] = field(default_factory=list)
    genres: List[str] = field(default_factory=list)
    platforms: List[str] = field(default_factory=list)
    developer: Optional[str] = None
    publisher: Optional[str] = None
    cover_image: Optional[str] = None
    rating: Optional[float] = None
    fetched_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())

    def to_dict(self):
        return asdict(self)