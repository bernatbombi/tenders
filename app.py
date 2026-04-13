"""
FastAPI app for dll-tenders scraper.

Endpoints:
  POST /tenders/refresh               — trigger full fetch (background)
  POST /tenders/{expediente}/detail   — fetch + store detail + upload docs (background)
  GET  /jobs/{job_id}                 — check job status

Auth: Authorization: Bearer <API_TOKEN>

Scheduler: daily fetch at 09:00 Europe/Madrid.
"""

import os
from contextlib import asynccontextmanager
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from dotenv import load_dotenv
from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from db import (
    create_job, update_job, get_job,
    upsert_tenders, upsert_tender_detail, get_collection,
    log_files_downloaded,
)
from scraper import DEFAULT_CPV, fetch_tenders, fetch_tender_detail
from storage import upload_from_url

load_dotenv()

_executor = ThreadPoolExecutor(max_workers=2)
_scheduler = AsyncIOScheduler(timezone="Europe/Madrid")
_security = HTTPBearer()


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

def _verify_token(credentials: HTTPAuthorizationCredentials = Depends(_security)):
    expected = os.environ.get("API_TOKEN")
    if not expected:
        raise HTTPException(status_code=500, detail="API_TOKEN not configured")
    if credentials.credentials != expected:
        raise HTTPException(status_code=401, detail="Invalid token")


# ---------------------------------------------------------------------------
# Background jobs
# ---------------------------------------------------------------------------

def _job_refresh(job_id: str, cpv: str = DEFAULT_CPV, max_pages: int = 0):
    update_job(job_id, status="running", startedAt=datetime.utcnow())
    try:
        print(f"[{job_id}] Starting fetch CPV={cpv}")
        tenders = fetch_tenders(cpv, max_pages)
        print(f"[{job_id}] Fetched {len(tenders)} tenders, saving...")
        upsert_tenders(tenders)
        update_job(job_id, status="done", finishedAt=datetime.utcnow())
        print(f"[{job_id}] Done.")
    except Exception as e:
        update_job(job_id, status="failed", finishedAt=datetime.utcnow(), error=str(e))
        print(f"[{job_id}] Failed: {e}")


def _job_detail(job_id: str, expediente: str):
    update_job(job_id, status="running", startedAt=datetime.utcnow())
    try:
        print(f"[{job_id}] Fetching detail for {expediente}")
        doc = get_collection().find_one({"expediente": expediente}, {"detail_url": 1})
        if not doc:
            raise ValueError(f"Expediente '{expediente}' not found in DB")

        detail = fetch_tender_detail(expediente, detail_url=doc.get("detail_url"))
        if not detail:
            raise ValueError(f"No detail returned for {expediente}")

        upsert_tender_detail(detail)
        _upload_documents(job_id, expediente, detail)
        update_job(job_id, status="done", finishedAt=datetime.utcnow())
        print(f"[{job_id}] Done.")
    except Exception as e:
        update_job(job_id, status="failed", finishedAt=datetime.utcnow(), error=str(e))
        print(f"[{job_id}] Failed: {e}")


def _upload_documents(job_id: str, expediente: str, detail: dict):
    prefix = expediente
    updates = {}

    for doc_key in ("documents", "sealedDocuments"):
        docs = detail.get(doc_key)
        if not docs:
            continue
        updated_docs = []
        for doc in docs:
            doc = dict(doc)
            if doc_key == "documents":
                updated_links = []
                for link in doc.get("links", []):
                    link = dict(link)
                    result = upload_from_url(link["url"], prefix=prefix)
                    if result:
                        link["r2"] = result
                    updated_links.append(link)
                doc["links"] = updated_links
            else:
                result = upload_from_url(doc["url"], prefix=prefix)
                if result:
                    doc["r2"] = result
            updated_docs.append(doc)
        updates[doc_key] = updated_docs

    if updates:
        get_collection().update_one({"expediente": expediente}, {"$set": updates})
        total = sum(
            len(doc.get("links", [])) if doc_key == "documents" else 1
            for doc_key, docs in updates.items()
            for doc in docs
        )
        log_files_downloaded(expediente, count=total)
        print(f"[{job_id}] Documents uploaded for {expediente}")


# ---------------------------------------------------------------------------
# App lifecycle
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    def _scheduled_refresh():
        job_id = create_job("refresh", trigger="scheduler")
        _executor.submit(_job_refresh, job_id)

    _scheduler.add_job(
        _scheduled_refresh,
        CronTrigger(hour=9, minute=0),
        id="daily_refresh",
        replace_existing=True,
    )
    _scheduler.start()
    print("[scheduler] Daily refresh scheduled at 09:00 Europe/Madrid")
    yield
    _scheduler.shutdown(wait=False)
    _executor.shutdown(wait=False)


app = FastAPI(title="dll-tenders", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.post("/tenders/refresh", dependencies=[Depends(_verify_token)])
async def refresh(background_tasks: BackgroundTasks):
    """Trigger a full tender fetch. Runs in background."""
    job_id = create_job("refresh", trigger="api")
    background_tasks.add_task(_executor.submit, _job_refresh, job_id)
    return {"jobId": job_id, "status": "pending"}


@app.post("/tenders/{expediente}/detail", dependencies=[Depends(_verify_token)])
async def detail(expediente: str, background_tasks: BackgroundTasks):
    """Fetch full detail + upload documents for a tender. Runs in background."""
    job_id = create_job("detail", expediente=expediente, trigger="api")
    background_tasks.add_task(_executor.submit, _job_detail, job_id, expediente)
    return {"jobId": job_id, "status": "pending", "expediente": expediente}


@app.get("/tenders/{expediente}", dependencies=[Depends(_verify_token)])
async def get_tender(expediente: str):
    """Get a tender and its detail from the database."""
    doc = get_collection().find_one({"expediente": expediente}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Tender not found")
    return doc


@app.get("/jobs/{job_id}", dependencies=[Depends(_verify_token)])
async def job_status(job_id: str):
    """Get the status of a background job."""
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job
