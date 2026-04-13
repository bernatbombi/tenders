# dll-tenders

Scraper for [Plataforma de Contratación del Estado](https://contrataciondelestado.es) — the Spanish public procurement platform.

Fetches tenders filtered by CPV code (default: `72200000` — IT software consulting/supply) with a submission deadline from today onwards.

## Setup

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
playwright install chromium
```

## Usage

### Fetch all tenders

```bash
python scrape_tenders.py                  # all pages, CPV 72200000
python scrape_tenders.py 72200000 5       # limit to 5 pages
```

Output is saved to `tenders.json`. Each tender has:

| Field                  | Type   | Example                        |
|------------------------|--------|--------------------------------|
| `expediente`           | string | `"2026-34"`                    |
| `description`          | string | `"Suministro e instalación..."` |
| `contract_type`        | string | `"Servicios"`                  |
| `contract_subtype`     | string | `"Servicios de informática..."` |
| `status`               | string | `"Publicada"`                  |
| `budget`               | number | `5296616.29`                   |
| `submission_deadline`  | string | `"2026-04-08"` (ISO date)      |
| `contracting_authority`| string | `"Ayuntamiento de ..."`        |
| `authority_url`        | string | URL to the authority profile   |
| `detail_url`           | string | Deep link to the tender detail |

### Fetch detail for a single tender

```bash
python scrape_tenders.py detail "2026-34"
python scrape_tenders.py detail "2026-34" tenders.json   # custom file
```

Looks up the `detail_url` from `tenders.json` and scrapes the full detail page. Returns additional fields:

| Field                    | Type     | Example                       |
|--------------------------|----------|-------------------------------|
| `estimated_value`        | number   | `5296616.29`                  |
| `procedure_type`         | string   | `"Abierto"`                   |
| `processing_type`        | string   | `"Ordinaria"`                 |
| `execution_location`     | string   | `"España - Barcelona"`        |
| `submission_method`      | string   | `"Electrónica"`               |
| `submission_deadline`    | string   | `"2026-04-08T14:00"` (w/ time)|
| `eu_financing`           | string   | `"Fondo Europeo de ..."`      |
| `cpv_codes`              | string[] | `["72000000", "48000000"]`    |
| `contracting_authority`  | string   | full name                     |
| `authority_classification`| string  | org hierarchy                 |
| `external_link`          | string   | link to regional platform     |
| `last_updated`           | string   | `"2026-03-03T12:04"`          |
| `publications`           | object[] | `[{"date":"2026-03-03","type":"Anuncio de Licitación","medium":"DOUE"}]` |
| `documents`              | object[] | `[{"title":"PCAP.pdf","link":"https://..."}]` |
| `awardee`                | string   | (if resolved)                 |
| `award_amount`           | number   | (if resolved)                 |
| `award_date`             | string   | (if resolved)                 |

### As a library

```python
from scrape_tenders import fetch_tenders, fetch_tender_detail

# Get all current tenders
tenders = fetch_tenders(cpv_code="72200000", max_pages=2)

# Get detail for one
detail = fetch_tender_detail("2026-34", tenders=tenders)

# Or with a direct URL
detail = fetch_tender_detail("2026-34", detail_url="https://contrataciondelestado.es/wps/poc?uri=deeplink:...")
```

## How it works

The platform is a JSF/WebSphere portal that requires JavaScript execution — plain HTTP requests don't work. This scraper uses [Playwright](https://playwright.dev/python/) to automate a headless Chromium browser:

1. Navigates to the search dashboard
2. Clicks "Licitaciones" to open the tender search form
3. Enters the CPV code and clicks "Añadir"
4. Sets "Presentación desde" to today's date
5. Clicks "Buscar" and paginates through results
6. For detail: opens the deep link URL and extracts all structured fields
