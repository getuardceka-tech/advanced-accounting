"""
Tests for:
- MODULE: documents/generate AUTO-SAVE of datum_prestanka_override (prestanak templates only)
- MODULE: GET /api/employees/history-by-jmbg (employment history across companies)
"""
import os
import re
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing from env and /app/frontend/.env")
BASE_URL = base_url.rstrip("/")

PRESTANAK_TEMPLATE = "RJESENJE O PRESTANKU RADNOG ODNOSA KAD ISTICE UGOVOR O RADU.docx"
OTHER_TEMPLATE = "UGOVOR O DOPUNSKOM RADU.docx"
COMPANY_ID = "3b295e48-3981-4edb-9d0c-5bb8aca93ebc"
EGZON_JMBG = "2301996220017"
TEST_JMBG = "9911223344556"


def _creds():
    content = Path("/app/memory/test_credentials.md").read_text(encoding="utf-8")
    user = re.search(r'(?im)^\s*(?:[-*]\s*)?(?:\*\*)?(?:Korisni[^:]*|username)(?:\*\*)?\s*:\s*`?([^`\s]+)', content)
    pwd = re.search(r'(?im)^\s*(?:[-*]\s*)?(?:\*\*)?(?:Lozinka|password)(?:\*\*)?\s*:\s*`?([^`\s]+)', content)
    if not user or not pwd:
        pytest.skip("credentials not found in /app/memory/test_credentials.md")
    return user.group(1), pwd.group(1)


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    user, pwd = _creds()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"username": user, "password": pwd}, timeout=30)
    if r.status_code != 200:
        pytest.fail(f"Login failed {r.status_code}: {r.text[:300]}")
    token = r.json().get("access_token") or r.json().get("token")
    if not token:
        pytest.fail(f"No token in login response: {r.text[:300]}")
    s.headers.update({"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def created_ids():
    return []


@pytest.fixture(scope="module", autouse=True)
def cleanup(client, created_ids):
    yield
    for eid in created_ids:
        client.delete(f"{BASE_URL}/api/employees/{eid}", timeout=30)


@pytest.fixture(scope="module")
def company_id(client):
    r = client.get(f"{BASE_URL}/api/companies/{COMPANY_ID}", timeout=30)
    if r.status_code == 200:
        return COMPANY_ID
    r = client.get(f"{BASE_URL}/api/companies", timeout=30)
    assert r.status_code == 200, r.text[:300]
    comps = r.json()
    assert comps, "No companies available"
    return comps[0]["id"]


def _mk_employee(client, created_ids, cid, **over):
    payload = {
        "company_id": cid, "ime": "TEST", "prezime": "AUTOSAVE",
        "jmbg": TEST_JMBG, "pozicija": "pomocni radnik",
        "vrsta_ugovora": "odredjeno", "datum_pocetka": "2026-01-01",
        "datum_kraja": "2026-12-31", "datum_prestanka": "", "aktivan": True,
    }
    payload.update(over)
    r = client.post(f"{BASE_URL}/api/employees", json=payload, timeout=30)
    assert r.status_code in (200, 201), f"create employee failed {r.status_code}: {r.text[:300]}"
    eid = r.json()["id"]
    created_ids.append(eid)
    return eid


def _generate(client, payload):
    return client.post(f"{BASE_URL}/api/documents/generate", json=payload, timeout=120)


# ============ AUTO-SAVE datum_prestanka ============

class TestAutoSaveDatumPrestanka:

    def test_prestanak_template_with_override_saves_and_archives(self, client, created_ids, company_id):
        eid = _mk_employee(client, created_ids, company_id, prezime="AUTOSAVEONE")
        r = _generate(client, {
            "template_filename": PRESTANAK_TEMPLATE,
            "company_id": company_id,
            "employee_id": eid,
            "custom_fields": {"datum_prestanka_override": "2026-11-15"},
        })
        assert r.status_code == 200, f"generate failed {r.status_code}: {r.text[:400]}"
        assert r.json().get("filename")

        g = client.get(f"{BASE_URL}/api/employees/{eid}", timeout=30)
        assert g.status_code == 200, g.text[:300]
        emp = g.json()
        assert emp["datum_prestanka"] == "2026-11-15", f"datum_prestanka not saved: {emp.get('datum_prestanka')!r}"
        assert emp["aktivan"] is False, f"aktivan not set to False: {emp.get('aktivan')!r}"

        # Should now appear in arhiva filter and NOT in aktivan filter
        ar = client.get(f"{BASE_URL}/api/employees", params={"company_id": company_id, "status": "arhiva"}, timeout=60)
        assert ar.status_code == 200, ar.text[:300]
        assert eid in [e["id"] for e in ar.json()], "employee missing from status=arhiva list"

        ak = client.get(f"{BASE_URL}/api/employees", params={"company_id": company_id, "status": "aktivan"}, timeout=60)
        assert ak.status_code == 200
        assert eid not in [e["id"] for e in ak.json()], "employee still present in status=aktivan list"

    def test_prestanak_template_without_override_does_not_modify(self, client, created_ids, company_id):
        eid = _mk_employee(client, created_ids, company_id, prezime="AUTOSAVETWO",
                           datum_prestanka="2026-06-30")
        r = _generate(client, {
            "template_filename": PRESTANAK_TEMPLATE,
            "company_id": company_id,
            "employee_id": eid,
            "custom_fields": {},
        })
        assert r.status_code == 200, f"generate failed {r.status_code}: {r.text[:400]}"
        emp = client.get(f"{BASE_URL}/api/employees/{eid}", timeout=30).json()
        assert emp["datum_prestanka"] == "2026-06-30", f"datum_prestanka changed: {emp.get('datum_prestanka')!r}"
        assert emp["aktivan"] is True, "aktivan flag should remain True when no override supplied"

    def test_other_template_with_override_does_not_modify(self, client, created_ids, company_id):
        eid = _mk_employee(client, created_ids, company_id, prezime="AUTOSAVETHREE",
                           datum_prestanka="", dopunski_rad=True, primary_employer="DRUGI DOO")
        r = _generate(client, {
            "template_filename": OTHER_TEMPLATE,
            "company_id": company_id,
            "employee_id": eid,
            "custom_fields": {"datum_prestanka_override": "2026-11-15"},
        })
        assert r.status_code == 200, f"generate failed {r.status_code}: {r.text[:400]}"
        emp = client.get(f"{BASE_URL}/api/employees/{eid}", timeout=30).json()
        assert emp["datum_prestanka"] == "", f"non-prestanak template must not save datum_prestanka, got {emp.get('datum_prestanka')!r}"
        assert emp["aktivan"] is True, "non-prestanak template must not deactivate employee"

    def test_empty_override_does_not_modify(self, client, created_ids, company_id):
        eid = _mk_employee(client, created_ids, company_id, prezime="AUTOSAVEFOUR",
                           datum_prestanka="")
        r = _generate(client, {
            "template_filename": PRESTANAK_TEMPLATE,
            "company_id": company_id,
            "employee_id": eid,
            "custom_fields": {"datum_prestanka_override": "   "},
        })
        assert r.status_code == 200, f"generate failed {r.status_code}: {r.text[:400]}"
        emp = client.get(f"{BASE_URL}/api/employees/{eid}", timeout=30).json()
        assert emp["datum_prestanka"] == ""
        assert emp["aktivan"] is True


# ============ GET /api/employees/history-by-jmbg ============

class TestHistoryByJmbg:

    def test_history_for_existing_jmbg(self, client):
        r = client.get(f"{BASE_URL}/api/employees/history-by-jmbg", params={"jmbg": EGZON_JMBG}, timeout=60)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:400]}"
        data = r.json()
        assert data["jmbg"] == EGZON_JMBG
        assert isinstance(data["count"], int)
        assert isinstance(data["history"], list)
        assert data["count"] == len(data["history"])
        if data["count"] == 0:
            pytest.skip("Seeded JMBG has no employment records in this environment")
        assert data["ime"], "ime missing in response"
        assert data["prezime"], "prezime missing in response"
        for rec in data["history"]:
            for key in ("company_naziv", "company_naziv_skraceni", "company_pib",
                        "status", "arhiva_reason", "arhiva_date"):
                assert key in rec, f"missing key {key} in history record"
            assert rec["status"] in ("aktivan", "arhiva"), rec["status"]
            assert "_id" not in rec
        starts = [rec.get("datum_pocetka", "") for rec in data["history"]]
        assert starts == sorted(starts, reverse=True), f"history not sorted desc by datum_pocetka: {starts}"

    def test_history_multiple_companies_sorted(self, client, created_ids, company_id):
        # Create two records with same JMBG, different start dates
        older = _mk_employee(client, created_ids, company_id, prezime="HISTORYOLD",
                             jmbg=TEST_JMBG, datum_pocetka="2024-02-01", datum_kraja="2024-12-31")
        newer = _mk_employee(client, created_ids, company_id, prezime="HISTORYNEW",
                             jmbg=TEST_JMBG, datum_pocetka="2026-03-01", datum_kraja="2026-12-31")
        r = client.get(f"{BASE_URL}/api/employees/history-by-jmbg", params={"jmbg": TEST_JMBG}, timeout=60)
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        ids = [rec["id"] for rec in data["history"]]
        assert older in ids and newer in ids, f"created records missing: {ids}"
        assert ids.index(newer) < ids.index(older), "records not sorted newest-first"
        # older 'odredjeno' contract expired -> arhiva
        old_rec = next(rec for rec in data["history"] if rec["id"] == older)
        assert old_rec["status"] == "arhiva"
        assert old_rec["arhiva_reason"] == "istekao"
        new_rec = next(rec for rec in data["history"] if rec["id"] == newer)
        assert new_rec["status"] == "aktivan", f"expected aktivan, got {new_rec}"

    def test_history_short_jmbg_returns_400(self, client):
        r = client.get(f"{BASE_URL}/api/employees/history-by-jmbg", params={"jmbg": "1"}, timeout=30)
        assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text[:300]}"
        assert "JMBG" in (r.json().get("detail") or "")

    def test_history_unknown_jmbg_returns_empty(self, client):
        r = client.get(f"{BASE_URL}/api/employees/history-by-jmbg", params={"jmbg": "99999999999"}, timeout=30)
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert data["count"] == 0
        assert data["history"] == []
        assert data["ime"] == "" and data["prezime"] == ""

    def test_history_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/employees/history-by-jmbg", params={"jmbg": EGZON_JMBG}, timeout=30)
        assert r.status_code in (401, 403), f"unauthenticated access allowed: {r.status_code}"

    def test_history_missing_param_returns_422(self, client):
        r = client.get(f"{BASE_URL}/api/employees/history-by-jmbg", timeout=30)
        assert r.status_code == 422, f"expected 422, got {r.status_code}: {r.text[:200]}"
