"""
Scraping library for Plataforma de Contratación del Estado.

The site is a JSF/WebSphere portal that requires JavaScript — plain HTTP
requests don't work, so all scraping is done via Playwright + headless Chromium.

Public API:
  fetch_tenders(cpv_code, max_pages) -> list[dict]
  fetch_tender_detail(expediente, tenders, detail_url) -> dict | None
  fetch_cpv_tree() -> list[dict]
"""

import html
import re
import xml.etree.ElementTree as ET
from datetime import date, datetime

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

SEARCH_URL = "https://contrataciondelestado.es/wps/portal/plataforma/buscadores/busqueda/"
DEFAULT_CPV_CODES = ["72000000", "72224000", "72413000"]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _parse_es_date(text: str) -> str | None:
    """Convert 'DD/MM/YYYY' or 'DD-MM-YYYY' to ISO 'YYYY-MM-DD'."""
    text = text.strip()
    for fmt in ("%d/%m/%Y", "%d-%m-%Y"):
        try:
            return datetime.strptime(text, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None


def _parse_es_amount(text: str) -> float | None:
    """Convert '1.376.405,13' to 1376405.13."""
    text = text.strip()
    if not text:
        return None
    cleaned = text.replace(".", "").replace(",", ".")
    try:
        return float(cleaned)
    except ValueError:
        return None


def _launch_browser(pw):
    """Create a headless Chromium browser + context."""
    browser = pw.chromium.launch(headless=True)
    context = browser.new_context(
        locale="es-ES",
        user_agent=(
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36"
        ),
    )
    return browser, context


# ---------------------------------------------------------------------------
# fetch_tenders
# ---------------------------------------------------------------------------

def fetch_tenders(cpv_codes: list[str] = DEFAULT_CPV_CODES, max_pages: int = 0) -> list[dict]:
    """
    Search tenders by CPV codes with submission deadline >= today.

    Args:
        cpv_codes: List of CPV codes to filter by.
        max_pages: Maximum pages to fetch. 0 = all pages.

    Returns:
        List of tender dicts with basic fields.
    """
    tenders = []

    with sync_playwright() as p:
        browser, context = _launch_browser(p)
        page = context.new_page()

        print("[1] Loading search dashboard...")
        page.goto(SEARCH_URL, wait_until="networkidle", timeout=30000)

        es_link = page.locator("a[lang='es'], a:text('ES')")
        if es_link.count() > 0:
            try:
                es_link.first.click()
                page.wait_for_load_state("networkidle", timeout=15000)
                print("    Switched to Spanish")
            except Exception:
                pass

        print("[2] Clicking 'Licitaciones' card...")
        licitaciones = page.locator("a[id$='linkFormularioBusqueda']").first
        licitaciones.wait_for(timeout=15000)
        licitaciones.click()
        page.wait_for_load_state("networkidle", timeout=30000)

        print(f"[3] Adding CPV codes: {', '.join(cpv_codes)}...")
        cpv_input = page.locator("input[id*='codigoCpv']").first
        cpv_input.wait_for(timeout=10000)
        add_btn = page.locator("a[id*='buttonAnyadirMultiple']").first

        for code in cpv_codes:
            cpv_input.fill(code)
            add_btn.click()
            page.wait_for_load_state("networkidle", timeout=15000)
            options = page.locator("#comboCPVnoPrincipal option").all()
            added = any(code in (opt.get_attribute("value") or "") for opt in options)
            print(f"    CPV {code} added: {added}")

        today_str = date.today().strftime("%d-%m-%Y")
        print(f"    Setting 'Presentación desde' = {today_str}")
        page.locator("input[id*='textMinFecLimite']").first.fill(today_str)

        print("[4] Searching...")
        page.locator("input[value='Buscar'][id*='button1']").first.click()
        page.wait_for_load_state("load", timeout=60000)
        page.wait_for_load_state("networkidle", timeout=60000)
        _wait_for_results(page)

        total_pages_el = page.locator("span[id*='textfooterInfoTotalPaginaMAQ']")
        total_results_el = page.locator("span[id*='textfooterTotalTotalMAQ']")
        total_pages = int(total_pages_el.inner_text()) if total_pages_el.count() > 0 else 1
        total_results = total_results_el.inner_text() if total_results_el.count() > 0 else "?"
        print(f"    Total: {total_results} tenders across {total_pages} pages")

        if max_pages > 0:
            total_pages = min(total_pages, max_pages)
            print(f"    Limiting to {total_pages} pages")

        for page_num in range(1, total_pages + 1):
            print(f"[5] Parsing page {page_num}/{total_pages}...")
            page_tenders = _parse_results_table(page)
            tenders.extend(page_tenders)
            print(f"    Got {len(page_tenders)} tenders (total: {len(tenders)})")

            if page_num < total_pages:
                next_btn = page.locator("input[id*='footerSiguiente']").first
                if next_btn.count() == 0 or not next_btn.is_visible():
                    print("    No more pages")
                    break
                next_btn.click()
                page.wait_for_load_state("networkidle", timeout=30000)
                _wait_for_results(page)

        browser.close()

    return tenders


def _wait_for_results(page, timeout: int = 30000):
    try:
        page.wait_for_selector("#myTablaBusquedaCustom tbody tr", state="attached", timeout=timeout)
    except PlaywrightTimeout:
        print("    Warning: results table not found within timeout")


def _parse_results_table(page) -> list[dict]:
    rows = page.locator("#myTablaBusquedaCustom tbody tr").all()
    tenders = []

    for row in rows:
        cells = row.locator("td").all()
        if len(cells) < 6:
            continue

        exp_span = cells[0].locator("span[id*='textoEnlace']").first
        expediente = exp_span.inner_text().strip() if exp_span.count() > 0 else ""

        desc_divs = cells[0].locator("div:not(.cell-order):not(.flex)").all()
        description = ""
        for d in desc_divs:
            t = d.inner_text().strip()
            if t and t != expediente:
                description = t
                break

        deeplink = cells[0].locator("a[href*='deeplink:detalle_licitacion']").first
        url = deeplink.get_attribute("href") if deeplink.count() > 0 else ""

        tipo_divs = cells[1].locator("div").all()
        contract_type = tipo_divs[0].inner_text().strip() if tipo_divs else ""
        contract_subtype = tipo_divs[1].inner_text().strip() if len(tipo_divs) > 1 else ""

        status = cells[2].inner_text().strip()
        budget = _parse_es_amount(cells[3].inner_text().strip())
        submission_deadline = _parse_es_date(cells[4].inner_text().strip())

        auth_el = cells[5].locator("a").first
        if auth_el.count() > 0:
            contracting_authority = auth_el.inner_text().strip()
            authority_url = auth_el.get_attribute("href") or ""
        else:
            contracting_authority = cells[5].inner_text().strip()
            authority_url = ""

        tenders.append({
            "expediente": expediente,
            "description": description,
            "contract_type": contract_type,
            "contract_subtype": contract_subtype,
            "status": status,
            "budget": budget,
            "submission_deadline": submission_deadline,
            "contracting_authority": contracting_authority,
            "authority_url": authority_url,
            "detail_url": url,
        })

    return tenders


# ---------------------------------------------------------------------------
# fetch_tender_detail
# ---------------------------------------------------------------------------

def fetch_tender_detail(
    expediente: str,
    tenders: list[dict] | None = None,
    detail_url: str | None = None,
) -> dict | None:
    """
    Fetch the detail page for a tender.

    Pass either `tenders` (list from fetch_tenders) to look up the URL,
    or `detail_url` directly.

    Returns a dict with all available fields merged (including expediente),
    or None if not found.
    """
    if detail_url is None and tenders is not None:
        match = next((t for t in tenders if t["expediente"] == expediente), None)
        if match is None:
            print(f"Expediente '{expediente}' not found in tenders list")
            return None
        detail_url = match.get("detail_url", "")

    if not detail_url:
        print(f"No detail URL for expediente '{expediente}'")
        return None

    print(f"Fetching detail for {expediente}...")

    with sync_playwright() as p:
        browser, context = _launch_browser(p)
        page = context.new_page()
        # Visit the portal homepage first to establish a session (cookies),
        # otherwise some portlets (e.g. "Otros Documentos") don't render.
        page.goto(SEARCH_URL, wait_until="networkidle", timeout=30000)
        page.goto(detail_url, wait_until="networkidle", timeout=30000)

        detail = {"expediente": expediente, "detail_url": detail_url}
        _extract_detail_fields(page, detail)

        # Fetch sealed documents from the HTML pliego page
        pliego_html_url = _find_pliego_html_url(detail)
        if pliego_html_url:
            sealed = _fetch_sealed_documents(page, pliego_html_url)
            if sealed:
                detail["sealedDocuments"] = sealed

        browser.close()

    return detail


def _extract_detail_fields(page, detail: dict):
    field_map = {
        "text_Expediente": ("expediente", "text"),
        "text_ObjetoContrato": ("description", "text"),
        "text_Estado": ("status", "text"),
        "text_Presupuesto": ("budget", "amount"),
        "text_ValorContrato": ("estimated_value", "amount"),
        "text_TipoContrato": ("contract_type", "text"),
        "text_Procedimiento": ("procedure_type", "text"),
        "text_TipoTramitacion": ("processing_type", "text"),
        "text_LugarEjecucion": ("execution_location", "text"),
        "text_SistemaContratacion": ("contracting_system", "text"),
        "text_PresentacionOferta": ("submission_method", "text"),
        "text_FinanciacionUE": ("eu_financing", "text"),
        "text_OC_con": ("contracting_authority", "text"),
        "text_UbicacionOrganica": ("authority_classification", "text"),
        "text_FechaPresentacionOfertaConHora": ("submission_deadline", "datetime"),
        "text_FechaActualizacion": ("last_updated", "datetime"),
        "text_EnlaceLicAgr": ("external_link", "text"),
    }

    for id_suffix, (key, field_type) in field_map.items():
        el = page.locator(f"span[id*='{id_suffix}']").first
        if el.count() == 0:
            continue
        value = (el.get_attribute("title") or el.inner_text()).strip()
        if not value:
            continue

        if field_type == "amount":
            parsed = _parse_es_amount(value.replace("Euros", "").strip())
            if parsed is not None:
                detail[key] = parsed
        elif field_type == "datetime":
            title_val = el.get_attribute("title") or ""
            m = re.match(r"(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})", title_val)
            if m:
                detail[key] = f"{m.group(1)}T{m.group(2)}"
            else:
                parts = value.split()
                parsed_date = _parse_es_date(parts[0]) if parts else None
                if parsed_date:
                    time_part = parts[1] if len(parts) > 1 else None
                    detail[key] = f"{parsed_date}T{time_part}" if time_part else parsed_date
        else:
            detail[key] = value

    cpv_el = page.locator("span[id*='text_CPV'], span[id*='CPV']").first
    if cpv_el.count() > 0:
        cpv_text = cpv_el.get_attribute("title") or cpv_el.inner_text()
        cpv_codes = re.findall(r"\b\d{8}\b", cpv_text)
        if cpv_codes:
            detail["cpv_codes"] = sorted(set(cpv_codes))

    award_fields = {
        "text_Adjudicatario": ("awardee", "text"),
        "text_ImporteAdjudicacion": ("award_amount", "amount"),
        "text_FechaAdjudicacion": ("award_date", "datetime"),
        "text_NumLicitadores": ("num_bidders", "text"),
    }
    for id_suffix, (key, field_type) in award_fields.items():
        el = page.locator(f"span[id*='{id_suffix}']").first
        if el.count() == 0:
            continue
        value = (el.get_attribute("title") or el.inner_text()).strip()
        if not value:
            continue
        if field_type == "amount":
            parsed = _parse_es_amount(value.replace("Euros", "").strip())
            if parsed is not None:
                detail[key] = parsed
        elif field_type == "datetime":
            m = re.match(r"(\d{4}-\d{2}-\d{2})", value)
            if m:
                detail[key] = m.group(1)
            else:
                parsed_date = _parse_es_date(value.split()[0])
                if parsed_date:
                    detail[key] = parsed_date
        else:
            detail[key] = value

    pub_rows = page.locator("#myTablaDetallePublicacionesPlatAgreVISUOE tbody tr").all()
    if pub_rows:
        publications = []
        for row in pub_rows:
            cells = row.locator("td").all()
            if len(cells) >= 3:
                pub_date = cells[0].inner_text().strip()
                publications.append({
                    "date": _parse_es_date(pub_date) or pub_date,
                    "type": cells[1].inner_text().strip(),
                    "medium": cells[2].inner_text().strip(),
                })
        if publications:
            detail["publications"] = publications

    # Primary documents table (pliegos)
    doc_table = page.locator(
        "#myTablaDetallePliegosPlatAgreVISUOE, "
        "table[id*='Pliegos'], table[id*='pliegos'], "
        "table[id*='Documentos'], table[id*='documentos']"
    ).first
    doc_rows = doc_table.locator("tbody tr").all() if doc_table.count() > 0 else []

    documents = []

    def _make_link(url: str, fmt: str = "") -> dict:
        return {"url": url, "format": fmt}

    # Pliegos table (old-style): col 0 = title, col 1 = single link, no format info
    for row in doc_rows:
        cells = row.locator("td").all()
        if len(cells) < 2:
            continue
        title = cells[0].inner_text().strip()
        link_el = row.locator("a[href]").first
        url = link_el.get_attribute("href") if link_el.count() > 0 else ""
        if url:
            documents.append({"title": title, "links": [_make_link(url)]})

    # Main documents table: #myTablaDetalleVISUOE
    # col 0 = date, col 1 = type, col 2 = format links (html/xml/pdf) + timestamp seal (href="#")
    for row in page.locator("#myTablaDetalleVISUOE tbody tr").all():
        cells = row.locator("td").all()
        if len(cells) < 3:
            continue
        title = cells[1].inner_text().strip()
        links = []
        for link_el in cells[2].locator("a[href]:not([href='#'])").all():
            url = link_el.get_attribute("href") or ""
            fmt = (link_el.locator("img").get_attribute("alt") or "").replace("Documento ", "")
            if url:
                links.append(_make_link(url, fmt))
        if links:
            documents.append({"title": title, "links": links})

    # Aux "Otros Documentos": malformed HTML makes Playwright locators unreliable.
    # Parse page.content() directly with BeautifulSoup instead.
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(page.content(), "html.parser")
    for a in soup.find_all("a", id=lambda v: v and "linkVerDocPadreGen" in v):
        url = a.get("href", "")
        if not url or url == "#":
            continue
        m = re.search(r":(\d+):linkVerDocPadreGen", a["id"])
        idx = m.group(1) if m else "0"
        title_span = soup.find("span", id=lambda v: v and f":{idx}:textStipo1PadreGen" in v)
        title = title_span.get_text(strip=True) if title_span else "Otro documento"
        documents.append({"title": title, "links": [_make_link(url)]})

    if documents:
        detail["documents"] = documents


def _find_pliego_html_url(detail: dict) -> str | None:
    """Return the HTML format URL of the Pliego document, if available."""
    for doc in detail.get("documents", []):
        if "pliego" not in doc.get("title", "").lower():
            continue
        for link in doc.get("links", []):
            if link.get("format") == "html":
                return link["url"]
    return None


def _fetch_sealed_documents(page, pliego_html_url: str) -> list[dict]:
    """
    Fetch the HTML pliego page and extract sealed documents from
    div.boxWithBackground .noremarca a links.
    """
    print(f"    Fetching sealed documents from pliego HTML...")
    page.goto(pliego_html_url, wait_until="networkidle", timeout=30000)

    with open("/tmp/pliego.html", "w") as f:
        f.write(page.content())
    print("    [debug] pliego HTML saved to /tmp/pliego.html")

    from bs4 import BeautifulSoup
    soup = BeautifulSoup(page.content(), "html.parser")
    first_box = soup.find("div", class_="box01")
    sealed = []
    if first_box:
        box_with_bg = first_box.find("div", class_="boxWithBackground")
        if box_with_bg:
            for a in box_with_bg.find_all("a", href=True):
                url = a["href"]
                title = a.get_text(strip=True)
                if url and title:
                    sealed.append({"title": title, "url": url})

    print(f"    Found {len(sealed)} sealed documents")
    return sealed


# ---------------------------------------------------------------------------
# fetch_cpv_tree
# ---------------------------------------------------------------------------

def fetch_cpv_tree() -> list[dict]:
    """
    Scrape the full CPV code hierarchy embedded as XML in the search form JS.

    Returns a list of top-level nodes:
      {"code": "03000000", "title": "Productos de la agricultura...", "children": [...]}
    """
    with sync_playwright() as p:
        browser, context = _launch_browser(p)
        page = context.new_page()

        print("[1] Loading search dashboard...")
        page.goto(SEARCH_URL, wait_until="networkidle", timeout=30000)

        print("[2] Clicking 'Licitaciones' card...")
        licitaciones = page.locator("a[id$='linkFormularioBusqueda']").first
        licitaciones.wait_for(timeout=15000)
        licitaciones.click()
        page.wait_for_load_state("networkidle", timeout=30000)

        print("[3] Opening CPV selection dialog...")
        cpv_btn = page.locator("a[id*='linkBuscarMultiple']").first
        cpv_btn.wait_for(timeout=10000)
        cpv_btn.click()
        page.wait_for_load_state("networkidle", timeout=30000)
        page.wait_for_timeout(2000)

        print("[4] Extracting CPV tree data...")
        page_html = page.content()
        browser.close()

    m = re.search(r'new hX_6\.XMLData\("(<ArbolCpv2.*?</ArbolCpv2\s*>)"\)', page_html)
    if not m:
        print("Error: CPV tree XML not found in page")
        return []

    xml_str = html.unescape(m.group(1))
    root = ET.fromstring(xml_str)

    def _parse_node(el) -> dict | None:
        desc_el = el.find("descripcion")
        if desc_el is None or not desc_el.text:
            return None
        parts = desc_el.text.split("-", 1)
        code = parts[0].strip()
        title = parts[1].strip() if len(parts) > 1 else ""
        children = [n for child in el.findall("NodoCpv") if (n := _parse_node(child))]
        result = {"code": code, "title": title}
        if children:
            result["children"] = children
        return result

    tree = [n for el in root.findall("NodoCpv") if (n := _parse_node(el))]
    print(f"    Found {len(tree)} top-level CPV divisions")
    return tree
