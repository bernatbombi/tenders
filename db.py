"""
MongoDB connection and persistence helpers.

Requires MONGODB_URI (and optionally MONGODB_DB) in the environment
or in a .env file at the project root.
"""

import os
from datetime import datetime
from pymongo import MongoClient, UpdateOne
from pymongo.collection import Collection
from dotenv import load_dotenv

load_dotenv()

_client: MongoClient | None = None

_DATE_FORMATS = ["%Y-%m-%dT%H:%M", "%Y-%m-%d"]
_DATE_FIELDS = {"submission_deadline", "last_updated", "award_date"}


def _parse_date(value: str | None) -> datetime | None:
    if not value:
        return None
    for fmt in _DATE_FORMATS:
        try:
            return datetime.strptime(value, fmt)
        except ValueError:
            continue
    return None


def _prepare(doc: dict) -> dict:
    """Convert all string date fields to datetime objects before storing."""
    d = dict(doc)
    for field in _DATE_FIELDS:
        if isinstance(d.get(field), str):
            parsed = _parse_date(d[field])
            if parsed:
                d[field] = parsed
    if isinstance(d.get("publications"), list):
        d["publications"] = [
            {**pub, "date": _parse_date(pub["date"]) or pub["date"]}
            if isinstance(pub.get("date"), str) else pub
            for pub in d["publications"]
        ]
    return d


def _get_client() -> MongoClient:
    global _client
    if _client is None:
        uri = os.environ.get("MONGODB_URI")
        if not uri:
            raise RuntimeError("MONGODB_URI is not set. Copy .env.example to .env and fill it in.")
        _client = MongoClient(uri)
    return _client


def get_collection(name: str = "tenders") -> Collection:
    db_name = os.environ.get("MONGODB_DB")
    client = _get_client()
    if db_name:
        return client[db_name][name]
    # Fall back to the database encoded in the URI
    return client.get_default_database()[name]


# ---------------------------------------------------------------------------
# Tenders
# ---------------------------------------------------------------------------

def upsert_tender(tender: dict) -> None:
    """Insert or update a tender by expediente."""
    t = _prepare(tender)
    get_collection().update_one(
        {"expediente": t["expediente"]},
        {"$set": t},
        upsert=True,
    )


def upsert_tenders(tenders: list[dict]) -> None:
    """Bulk upsert a list of tenders."""
    if not tenders:
        return
    ops = [
        UpdateOne({"expediente": t["expediente"]}, {"$set": t}, upsert=True)
        for t in [_prepare(t) for t in tenders]
    ]
    result = get_collection().bulk_write(ops)
    print(f"    DB: {result.upserted_count} inserted, {result.modified_count} updated")


def upsert_tender_detail(detail: dict) -> None:
    """Merge detail fields into the existing tender document."""
    d = _prepare(detail)
    get_collection().update_one(
        {"expediente": d["expediente"]},
        {"$set": d},
        upsert=True,
    )
