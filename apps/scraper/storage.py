"""
Cloudflare R2 storage helpers.

Requires in .env:
  R2_ACCOUNT_ID
  R2_ACCESS_KEY_ID
  R2_SECRET_ACCESS_KEY
  R2_BUCKET
  R2_PUBLIC_URL   (optional — base URL for public access, e.g. https://cdn.example.com)
"""

import hashlib
import mimetypes
import os
import re
from urllib.parse import urlparse, parse_qs
from urllib.request import urlopen, Request

import boto3
from botocore.config import Config
from dotenv import load_dotenv

load_dotenv()

_EXTENSION_FIXES = {".jpe": ".jpg", ".jpeg": ".jpg"}


def _r2_client():
    return boto3.client(
        "s3",
        endpoint_url=f"https://{os.environ['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com",
        aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
        config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
        region_name="auto",
    )


def _derive_filename(url: str, content_type: str, content_disposition: str) -> str:
    # 1. Content-Disposition header
    if content_disposition:
        m = re.search(r'filename[^;=\n]*=(["\']?)([^"\'\n;]+)\1', content_disposition)
        if m:
            return m.group(2).strip()

    # 2. Extension from content type
    mime = content_type.split(";")[0].strip()
    ext = mimetypes.guess_extension(mime) if mime else ""
    ext = _EXTENSION_FIXES.get(ext, ext) if ext else ""

    # 3. Stable name: hash of DocumentIdParam for FileSystem servlet URLs, else hash of URL
    qs = parse_qs(urlparse(url).query)
    seed = qs.get("DocumentIdParam", [url])[0]
    name = hashlib.sha1(seed.encode()).hexdigest()[:16]

    return f"{name}{ext}"


def upload_from_url(url: str, prefix: str = "") -> dict | None:
    """
    Download a file from `url` and upload it to R2.

    Args:
        url:    Source URL to download from.
        prefix: Key prefix in the bucket (e.g. "tenders/1579267C").

    Returns:
        {"key": "tenders/1579267C/abc123.pdf", "publicUrl": "https://..."}
        or None on failure.
    """
    bucket = os.environ.get("R2_BUCKET")
    if not bucket:
        raise RuntimeError("R2_BUCKET is not set.")

    try:
        req = Request(url, headers={"User-Agent": "Mozilla/5.0"})
        response = urlopen(req, timeout=30)
        content = response.read()
        content_type = response.headers.get("Content-Type", "application/octet-stream")
        content_disposition = response.headers.get("Content-Disposition", "")
    except Exception as e:
        print(f"    [storage] Download failed ({url[:80]}...): {e}")
        return None

    filename = _derive_filename(url, content_type, content_disposition)
    key = f"{prefix}/{filename}".lstrip("/")

    try:
        _r2_client().put_object(
            Bucket=bucket,
            Key=key,
            Body=content,
            ContentType=content_type.split(";")[0].strip(),
        )
    except Exception as e:
        print(f"    [storage] Upload failed ({key}): {e}")
        return None

    print(f"    [storage] Uploaded {key}")

    result = {"key": key}
    public_base = os.environ.get("R2_PUBLIC_URL", "").rstrip("/")
    if public_base:
        result["publicUrl"] = f"{public_base}/{key}"

    return result
