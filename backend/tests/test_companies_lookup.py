"""Tests for company creation and IRMS PIB lookup graceful UX."""
import os
import re
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
BASE_URL = base_url.rstrip("/")

TEST_UNIQUE_PIB = "99999123"
EXISTING_PIB = "02268400"
INVALID_PIB = "123"


@pytest.fixture(scope="module")
def creds():
    txt = Path("/app/memory/test_credentials.md").read_text()
    u = re.search(r"[Kk]orisničko ime\**\s*:\s*`?([^\s`]+)", txt).group(1)
    p = re.search(r"[Ll]ozinka\**\s*:\s*`?([^\s`]+)", txt).group(1)
    return {"username": u, "password": p}


@pytest.fixture(scope="module")
def token(creds):
    r = requests.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=15)
    assert r.status_code == 200, f"login failed {r.status_code} {r.text[:200]}"
    return r.json()["access_token"] if "access_token" in r.json() else r.json().get("token")


@pytest.fixture(scope="module")
def auth(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def created_ids():
    ids = []
    yield ids
    # cleanup
    for cid in ids:
        try:
            requests.delete(f"{BASE_URL}/api/companies/{cid}", headers={"Authorization": f"Bearer {ids_token[0]}"} if False else {}, timeout=10)
        except Exception:
            pass


def test_create_company_unique_pib(auth, created_ids):
    payload = {
        "pib": TEST_UNIQUE_PIB,
        "naziv": "TEST FIRMA UNIQUE DOO",
        "adresa": "Test bb, Podgorica",
        "grad": "Podgorica",
    }
    # cleanup if existing
    lst = requests.get(f"{BASE_URL}/api/companies", headers=auth, timeout=10).json()
    for c in lst:
        if c.get("pib") == TEST_UNIQUE_PIB:
            requests.delete(f"{BASE_URL}/api/companies/{c['id']}", headers=auth, timeout=10)

    r = requests.post(f"{BASE_URL}/api/companies", json=payload, headers=auth, timeout=15)
    assert r.status_code in (200, 201), f"{r.status_code}: {r.text[:300]}"
    data = r.json()
    assert data["pib"] == TEST_UNIQUE_PIB
    assert data["naziv"] == payload["naziv"]
    assert "id" in data
    created_ids.append(data["id"])

    # Verify persistence via GET
    g = requests.get(f"{BASE_URL}/api/companies/{data['id']}", headers=auth, timeout=10)
    assert g.status_code == 200
    assert g.json()["pib"] == TEST_UNIQUE_PIB

    # cleanup immediately
    d = requests.delete(f"{BASE_URL}/api/companies/{data['id']}", headers=auth, timeout=10)
    assert d.status_code in (200, 204)
    created_ids.remove(data["id"])


def test_create_company_existing_pib_returns_400(auth):
    """Existing PIB must return 400 with 'već postoji' message."""
    payload = {
        "pib": EXISTING_PIB,
        "naziv": "SHOULD NOT CREATE",
        "adresa": "x",
        "grad": "x",
    }
    r = requests.post(f"{BASE_URL}/api/companies", json=payload, headers=auth, timeout=15)
    assert r.status_code == 400, f"expected 400 got {r.status_code}: {r.text[:200]}"
    body = r.text.lower()
    assert "već postoji" in body or "vec postoji" in body, f"expected 'već postoji' in {body[:200]}"


def test_lookup_pib_existing_graceful(auth):
    """IRMS lookup for existing PIB should NOT return 500 and should be fast."""
    import time
    t0 = time.time()
    r = requests.get(f"{BASE_URL}/api/companies/lookup-pib", params={"pib": EXISTING_PIB}, headers=auth, timeout=15)
    elapsed = time.time() - t0
    assert r.status_code == 200, f"expected 200 (not 500), got {r.status_code}: {r.text[:200]}"
    data = r.json()
    assert data.get("success") is False, f"expected success=false, got {data}"
    msg = (data.get("message") or "").lower()
    assert any(k in msg for k in ["recaptcha", "irms", "ručno", "rucno", "portal"]), f"message not helpful: {msg}"
    assert elapsed < 15, f"lookup too slow: {elapsed}s"


def test_lookup_pib_invalid_short(auth):
    """Invalid short PIB must return 400."""
    r = requests.get(f"{BASE_URL}/api/companies/lookup-pib", params={"pib": INVALID_PIB}, headers=auth, timeout=10)
    assert r.status_code == 400, f"expected 400 got {r.status_code}: {r.text[:200]}"
    body = r.text.lower()
    assert "6" in body or "cifar" in body or "digit" in body, f"expected message about 6 digits: {body[:200]}"
