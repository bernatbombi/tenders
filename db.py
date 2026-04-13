"""
MongoDB connection and persistence helpers.

Requires MONGODB_URI (and optionally MONGODB_DB) in the environment
or in a .env file at the project root.
"""

import os
import uuid
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
    col = get_collection()
    existing = {
        doc["expediente"]
        for doc in col.find({"expediente": {"$in": [t["expediente"] for t in tenders]}}, {"expediente": 1})
    }
    ops = [
        UpdateOne({"expediente": t["expediente"]}, {"$set": t}, upsert=True)
        for t in [_prepare(t) for t in tenders]
    ]
    result = col.bulk_write(ops)
    for t in tenders:
        if t["expediente"] not in existing:
            log_added(t["expediente"])
        else:
            log_updated(t["expediente"])
    print(f"    DB: {result.upserted_count} inserted, {result.modified_count} updated")


def upsert_tender_detail(detail: dict) -> None:
    """Merge detail fields into the existing tender document."""
    d = _prepare(detail)
    get_collection().update_one(
        {"expediente": d["expediente"]},
        {"$set": d},
        upsert=True,
    )
    log_detail_updated(d["expediente"])


# ---------------------------------------------------------------------------
# Jobs
# ---------------------------------------------------------------------------

def create_job(type: str, **meta) -> str:
    """Create a new job record, return its ID."""
    job_id = str(uuid.uuid4())
    get_collection("jobs").insert_one({
        "_id": job_id,
        "type": type,
        "status": "pending",
        "createdAt": datetime.utcnow(),
        "startedAt": None,
        "finishedAt": None,
        "error": None,
        **meta,
    })
    return job_id


def update_job(job_id: str, **fields) -> None:
    get_collection("jobs").update_one({"_id": job_id}, {"$set": fields})


def get_job(job_id: str) -> dict | None:
    doc = get_collection("jobs").find_one({"_id": job_id})
    if doc:
        doc["jobId"] = doc.pop("_id")
    return doc


# ---------------------------------------------------------------------------
# History
# ---------------------------------------------------------------------------

def _log(expediente: str, event: str, **meta) -> None:
    get_collection("history").insert_one({
        "expediente": expediente,
        "event": event,
        "at": datetime.utcnow(),
        **meta,
    })


def log_added(expediente: str) -> None:
    _log(expediente, "added")


def log_updated(expediente: str) -> None:
    _log(expediente, "updated")


def log_detail_updated(expediente: str) -> None:
    _log(expediente, "detail_updated")


def log_files_downloaded(expediente: str, count: int) -> None:
    _log(expediente, "files_downloaded", count=count)
