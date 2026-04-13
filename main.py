#!/usr/bin/env python3
"""
dll-tenders CLI

Usage:
  python main.py                          # fetch all tenders (CPV 72200000), save to DB
  python main.py 72200000 5              # limit to 5 pages
  python main.py detail <expediente>     # fetch + save full detail for one tender
  python main.py cpv                     # dump full CPV code tree to cpv_codes.json
"""

import json
import sys

from scraper import DEFAULT_CPV, fetch_cpv_tree, fetch_tender_detail, fetch_tenders
from db import upsert_tenders, upsert_tender_detail
from storage import upload_from_url


def cmd_fetch(cpv: str, max_pages: int) -> None:
    print(f"=== Scraping tenders with CPV: {cpv} ===\n")
    tenders = fetch_tenders(cpv, max_pages)
    print(f"\n=== Found {len(tenders)} tenders ===\n")

    for i, t in enumerate(tenders[:5], 1):
        print(f"--- Tender {i} ---")
        for k, v in t.items():
            if v:
                print(f"  {k}: {str(v)[:120]}")
        print()

    if len(tenders) > 5:
        print(f"... and {len(tenders) - 5} more\n")

    print("Saving to MongoDB...")
    upsert_tenders(tenders)
    print("Done.")


def cmd_detail(expediente: str) -> None:
    from db import get_collection

    # Look up the detail_url from the DB
    doc = get_collection().find_one({"expediente": expediente}, {"detail_url": 1})
    if not doc:
        print(f"Expediente '{expediente}' not found in DB. Run fetch first.")
        sys.exit(1)

    detail = fetch_tender_detail(expediente, detail_url=doc.get("detail_url"))
    if not detail:
        print("No detail found.")
        sys.exit(1)

    print(json.dumps(detail, ensure_ascii=False, indent=2))

    print("\nSaving detail to MongoDB...")
    upsert_tender_detail(detail)

    _upload_tender_documents(expediente, detail)
    print("Done.")


def _upload_tender_documents(expediente: str, detail: dict) -> None:
    from db import get_collection

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
        get_collection().update_one(
            {"expediente": expediente},
            {"$set": updates},
        )
        print(f"    Uploaded documents and updated DB.")


def cmd_cpv() -> None:
    tree = fetch_cpv_tree()
    output_file = "cpv_codes.json"
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(tree, f, ensure_ascii=False, indent=2)
    print(f"CPV tree saved to {output_file}")


def main() -> None:
    args = sys.argv[1:]

    if args and args[0] == "cpv":
        cmd_cpv()

    elif args and args[0] == "detail":
        if len(args) < 2:
            print("Usage: python main.py detail <expediente>")
            sys.exit(1)
        cmd_detail(args[1])

    else:
        cpv = args[0] if args else DEFAULT_CPV
        max_pages = int(args[1]) if len(args) > 1 else 0
        cmd_fetch(cpv, max_pages)


if __name__ == "__main__":
    main()
