"""
Tender document analysis using Anthropic Claude.

Reads prompt files from analyzer/prompts/ and sends documents via presigned R2 URLs.
"""

import json
from pathlib import Path

import anthropic

PROMPTS_DIR = Path(__file__).parent / "prompts"
MODEL = "claude-sonnet-4-6"
MAX_TOKENS = 16000


def load_system_prompt() -> str:
    system = (PROMPTS_DIR / "system.txt").read_text(encoding="utf-8")
    questions = (PROMPTS_DIR / "questions.txt").read_text(encoding="utf-8")
    schema = (PROMPTS_DIR / "schema.json").read_text(encoding="utf-8")
    return "\n\n".join([
        system,
        "─── QUESTIONS TO ANSWER ─────────────────────────────────────────────────────────",
        questions,
        "─── OUTPUT SCHEMA ───────────────────────────────────────────────────────────────",
        "Return a JSON object that matches this schema exactly:",
        schema,
    ])


def _collect_document_urls(tender_doc: dict, generate_presigned_url) -> list[dict]:
    """Return list of {title, url} from sealedDocuments, using presigned URLs."""
    result = []

    for doc in tender_doc.get("sealedDocuments", []):
        r2 = doc.get("r2")
        if not r2 or not r2.get("key"):
            continue
        result.append({
            "title": doc.get("title", ""),
            "url": generate_presigned_url(r2["key"]),
        })

    return result


def analyze(expediente: str, tender_doc: dict, generate_presigned_url) -> dict:
    """
    Analyse tender documents with Claude.

    Args:
        expediente: Tender ID (for logging).
        tender_doc: Full tender document from MongoDB.
        generate_presigned_url: Callable(key) -> presigned URL string.

    Returns:
        Parsed JSON dict from Claude's response.

    Raises:
        ValueError: If no documents available or Claude returns invalid JSON.
    """
    docs = _collect_document_urls(tender_doc, generate_presigned_url)
    if not docs:
        raise ValueError(f"No R2 documents found for {expediente}")

    print(f"    [analyzer] {len(docs)} document(s) to analyse for {expediente}")

    content = []
    for doc in docs:
        content.append({
            "type": "text",
            "text": f"Document: {doc['title']}\nURL: {doc['url']}",
        })

    content.append({
        "type": "text",
        "text": (
            "Analyse the provided bid documents following the system instructions. "
            "The first document is the primary Pliegos. "
            "Return only the JSON object — no markdown, no explanation."
        ),
    })

    client = anthropic.Anthropic()
    message = client.messages.create(
        model=MODEL,
        max_tokens=MAX_TOKENS,
        system=load_system_prompt(),
        messages=[{"role": "user", "content": content}],
    )

    raw = message.content[0].text.strip()

    # Strip markdown code block if present
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[-1]
        raw = raw.rsplit("```", 1)[0].strip()

    try:
        return json.loads(raw)
    except json.JSONDecodeError as e:
        raise ValueError(f"Claude returned invalid JSON: {e}\n\nRaw:\n{raw[:500]}")
