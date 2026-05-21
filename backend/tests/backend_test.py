"""
GETUARD AGENCY - Backend API tests
Tests: auth, agency, companies CRUD, IRMS lookup, employees CRUD, templates,
       document generation, PDV tracking, stats
"""
import os
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://dobar-dan.preview.emergentagent.com').rstrip('/')
API = f"{BASE_URL}/api"

USERNAME = "getuard"
PASSWORD = "Getuard1994."


# ---------- Fixtures ----------

@pytest.fixture(scope="session")
def token():
    r = requests.post(f"{API}/auth/login", json={"username": USERNAME, "password": PASSWORD}, timeout=30)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def auth_headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def test_company(auth_headers):
    """Create a test company and clean up after session."""
    # Try delete any existing one with this PIB first
    payload = {
        "naziv": "TEST_FIRMA_DOO",
        "pib": "99887766",
        "naziv_skraceni": "TEST DOO",
        "adresa": "Test ulica 1",
        "grad": "Ulcinj",
        "direktor_ime": "Test Direktor",
        "direktor_jmbg": "1234567890123",
        "pdv_obveznik": True,
        "ioppd_obveznik": True,
        "aktivna": True,
    }
    # cleanup if leftover
    existing = requests.get(f"{API}/companies?search=99887766", headers=auth_headers).json()
    for c in existing:
        requests.delete(f"{API}/companies/{c['id']}", headers=auth_headers)

    r = requests.post(f"{API}/companies", json=payload, headers=auth_headers)
    assert r.status_code == 200, f"Create company failed: {r.text}"
    data = r.json()
    yield data
    # teardown
    requests.delete(f"{API}/companies/{data['id']}", headers=auth_headers)


# ---------- AUTH ----------

class TestAuth:
    def test_login_success(self):
        r = requests.post(f"{API}/auth/login", json={"username": USERNAME, "password": PASSWORD})
        assert r.status_code == 200
        d = r.json()
        assert "access_token" in d
        assert d["user"]["username"] == USERNAME
        assert isinstance(d["access_token"], str) and len(d["access_token"]) > 10

    def test_login_wrong_password(self):
        r = requests.post(f"{API}/auth/login", json={"username": USERNAME, "password": "wrong"})
        assert r.status_code == 401

    def test_login_unknown_user(self):
        r = requests.post(f"{API}/auth/login", json={"username": "nouser", "password": "x"})
        assert r.status_code == 401

    def test_me_with_token(self, auth_headers):
        r = requests.get(f"{API}/auth/me", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["username"] == USERNAME

    def test_me_without_token(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code in (401, 403)


# ---------- AGENCY ----------

class TestAgency:
    def test_get_agency_returns_default(self, auth_headers):
        r = requests.get(f"{API}/agency", headers=auth_headers)
        assert r.status_code == 200
        d = r.json()
        assert d.get("naziv")
        assert "direktor_ime" in d

    def test_update_agency(self, auth_headers):
        # First, get current
        cur = requests.get(f"{API}/agency", headers=auth_headers).json()
        updated = dict(cur)
        updated["telefon"] = "+38269123456"
        r = requests.put(f"{API}/agency", json=updated, headers=auth_headers)
        assert r.status_code == 200
        # Verify persistence
        new = requests.get(f"{API}/agency", headers=auth_headers).json()
        assert new["telefon"] == "+38269123456"


# ---------- COMPANIES CRUD ----------

class TestCompanies:
    def test_create_get_update_delete(self, auth_headers):
        payload = {"naziv": "TEST_CRUD_FIRMA", "pib": "11223344", "grad": "Ulcinj"}
        # Ensure clean
        existing = requests.get(f"{API}/companies?search=11223344", headers=auth_headers).json()
        for c in existing:
            requests.delete(f"{API}/companies/{c['id']}", headers=auth_headers)

        # CREATE
        r = requests.post(f"{API}/companies", json=payload, headers=auth_headers)
        assert r.status_code == 200, r.text
        c = r.json()
        assert c["naziv"] == "TEST_CRUD_FIRMA"
        assert c["pib"] == "11223344"
        cid = c["id"]

        # GET single
        r = requests.get(f"{API}/companies/{cid}", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["pib"] == "11223344"

        # LIST
        r = requests.get(f"{API}/companies", headers=auth_headers)
        assert r.status_code == 200
        assert any(x["id"] == cid for x in r.json())

        # UPDATE
        upd = {**payload, "adresa": "Nova adresa 5"}
        r = requests.put(f"{API}/companies/{cid}", json=upd, headers=auth_headers)
        assert r.status_code == 200
        # Verify persisted
        r = requests.get(f"{API}/companies/{cid}", headers=auth_headers)
        assert r.json()["adresa"] == "Nova adresa 5"

        # DELETE
        r = requests.delete(f"{API}/companies/{cid}", headers=auth_headers)
        assert r.status_code == 200
        # Verify removed
        r = requests.get(f"{API}/companies/{cid}", headers=auth_headers)
        assert r.status_code == 404

    def test_duplicate_pib_returns_400(self, auth_headers, test_company):
        dup = {"naziv": "OTHER", "pib": test_company["pib"]}
        r = requests.post(f"{API}/companies", json=dup, headers=auth_headers)
        assert r.status_code == 400

    def test_search_filter(self, auth_headers, test_company):
        r = requests.get(f"{API}/companies?search=TEST_FIRMA", headers=auth_headers)
        assert r.status_code == 200
        assert any(c["id"] == test_company["id"] for c in r.json())

    def test_pdv_only_filter(self, auth_headers, test_company):
        r = requests.get(f"{API}/companies?pdv_only=true", headers=auth_headers)
        assert r.status_code == 200
        for c in r.json():
            assert c.get("pdv_obveznik") is True

    def test_ioppd_only_filter(self, auth_headers, test_company):
        r = requests.get(f"{API}/companies?ioppd_only=true", headers=auth_headers)
        assert r.status_code == 200
        for c in r.json():
            assert c.get("ioppd_obveznik") is True


# ---------- IRMS LOOKUP ----------

class TestIRMS:
    def test_lookup_valid_pib_does_not_crash(self, auth_headers):
        r = requests.get(f"{API}/companies/lookup-pib?pib=03801969", headers=auth_headers, timeout=60)
        assert r.status_code == 200
        d = r.json()
        assert "success" in d
        assert "message" in d
        assert d["pib"] == "03801969"

    def test_lookup_invalid_pib_returns_400(self, auth_headers):
        r = requests.get(f"{API}/companies/lookup-pib?pib=abc123", headers=auth_headers)
        assert r.status_code == 400

    def test_lookup_empty_pib_returns_400(self, auth_headers):
        r = requests.get(f"{API}/companies/lookup-pib?pib=", headers=auth_headers)
        assert r.status_code == 400


# ---------- EMPLOYEES CRUD ----------

class TestEmployees:
    def test_employee_crud(self, auth_headers, test_company):
        payload = {
            "company_id": test_company["id"],
            "ime": "Marko",
            "prezime": "Markovic",
            "jmbg": "1234567890123",
            "pozicija": "Konobar",
            "plata_neto": 500.0,
            "plata_bruto": 700.0,
        }
        # CREATE
        r = requests.post(f"{API}/employees", json=payload, headers=auth_headers)
        assert r.status_code == 200, r.text
        e = r.json()
        eid = e["id"]
        assert e["ime"] == "Marko"

        # LIST by company
        r = requests.get(f"{API}/employees?company_id={test_company['id']}", headers=auth_headers)
        assert r.status_code == 200
        assert any(x["id"] == eid for x in r.json())

        # UPDATE
        upd = {**payload, "pozicija": "Šef sale"}
        r = requests.put(f"{API}/employees/{eid}", json=upd, headers=auth_headers)
        assert r.status_code == 200
        r = requests.get(f"{API}/employees/{eid}", headers=auth_headers)
        assert r.json()["pozicija"] == "Šef sale"

        # DELETE
        r = requests.delete(f"{API}/employees/{eid}", headers=auth_headers)
        assert r.status_code == 200
        r = requests.get(f"{API}/employees/{eid}", headers=auth_headers)
        assert r.status_code == 404

    def test_employee_invalid_company_returns_400(self, auth_headers):
        payload = {"company_id": "nonexistent-id", "ime": "X", "prezime": "Y"}
        r = requests.post(f"{API}/employees", json=payload, headers=auth_headers)
        assert r.status_code == 400


# ---------- TEMPLATES ----------

class TestTemplates:
    def test_list_templates(self, auth_headers):
        r = requests.get(f"{API}/templates", headers=auth_headers)
        assert r.status_code == 200
        templates = r.json()
        assert isinstance(templates, list)
        # Around 57 templates expected
        assert len(templates) >= 50, f"Expected ~57 templates, got {len(templates)}"
        # Verify shape
        sample = templates[0]
        for key in ("filename", "name", "category", "extension", "supports_generation"):
            assert key in sample
        # Some categories expected
        cats = {t["category"] for t in templates}
        assert any(c in cats for c in ("Ugovori", "Odluke", "Obavještenja", "Zahtjevi", "Ovlaštenja i punomoći"))


# ---------- DOCUMENT GENERATION ----------

class TestDocumentGeneration:
    def test_generate_and_download(self, auth_headers, test_company, token):
        template_name = "OVLASCENJE ZA RACUNOVODSTVO -GETUARD CEKOVIQ.docx"
        payload = {"template_filename": template_name, "company_id": test_company["id"]}
        r = requests.post(f"{API}/documents/generate", json=payload, headers=auth_headers)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["success"] is True
        assert d["filename"].endswith(".docx")
        assert "download_url" in d

        # Download with token
        download_url = f"{BASE_URL}{d['download_url']}?token={token}"
        rd = requests.get(download_url)
        assert rd.status_code == 200
        assert len(rd.content) > 1000  # docx is reasonably big

        # Verify record in /documents
        r = requests.get(f"{API}/documents?company_id={test_company['id']}", headers=auth_headers)
        assert r.status_code == 200
        assert any(x["filename"] == d["filename"] for x in r.json())

    def test_generate_unknown_template_returns_404(self, auth_headers, test_company):
        payload = {"template_filename": "NEPOSTOJECI.docx", "company_id": test_company["id"]}
        r = requests.post(f"{API}/documents/generate", json=payload, headers=auth_headers)
        assert r.status_code == 404

    def test_generate_non_docx_returns_400(self, auth_headers, test_company):
        # Find a non-docx template
        templates = requests.get(f"{API}/templates", headers=auth_headers).json()
        non_docx = [t for t in templates if t["extension"] != ".docx"]
        if not non_docx:
            pytest.skip("No non-docx template available")
        payload = {"template_filename": non_docx[0]["filename"], "company_id": test_company["id"]}
        r = requests.post(f"{API}/documents/generate", json=payload, headers=auth_headers)
        assert r.status_code == 400


# ---------- PDV TRACKING ----------

class TestPDVTracking:
    def test_get_pdv_tracking(self, auth_headers, test_company):
        r = requests.get(f"{API}/pdv-tracking?year=2026&month=2", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        # Our test company has pdv_obveznik & ioppd_obveznik true
        assert any(d["company_id"] == test_company["id"] for d in data)

    def test_update_pdv_tracking(self, auth_headers, test_company):
        cid = test_company["id"]
        r = requests.put(
            f"{API}/pdv-tracking/{cid}?year=2026&month=2",
            json={"pdv_predato": True},
            headers=auth_headers,
        )
        assert r.status_code == 200
        # Verify
        r = requests.get(f"{API}/pdv-tracking?year=2026&month=2", headers=auth_headers)
        rec = next((d for d in r.json() if d["company_id"] == cid), None)
        assert rec is not None
        assert rec["pdv_predato"] is True
        assert rec["pdv_datum"]  # auto-filled date

        # Toggle ioppd
        r = requests.put(
            f"{API}/pdv-tracking/{cid}?year=2026&month=2",
            json={"ioppd_predato": True, "ioppd_broj": "BR-001"},
            headers=auth_headers,
        )
        assert r.status_code == 200
        r = requests.get(f"{API}/pdv-tracking?year=2026&month=2", headers=auth_headers)
        rec = next((d for d in r.json() if d["company_id"] == cid), None)
        assert rec["ioppd_predato"] is True
        assert rec["ioppd_broj"] == "BR-001"


# ---------- STATS ----------

class TestStats:
    def test_stats_shape(self, auth_headers):
        r = requests.get(f"{API}/stats", headers=auth_headers)
        assert r.status_code == 200
        d = r.json()
        for key in ("total_companies", "active_companies", "pdv_count", "ioppd_count", "total_employees", "docs_this_month"):
            assert key in d
            assert isinstance(d[key], int)
