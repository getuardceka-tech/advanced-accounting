"""
GETUARD AGENCY - Računovodstveni softver za Crnu Goru
Backend API
"""
from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, UploadFile, File
from fastapi.responses import FileResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import re
import uuid
import jwt
import bcrypt
import requests
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
from docx import Document
import copy

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

TEMPLATES_DIR = ROOT_DIR / "templates"
GENERATED_DIR = ROOT_DIR / "generated"
GENERATED_DIR.mkdir(exist_ok=True)

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Auth config
JWT_SECRET = os.environ.get('JWT_SECRET', 'getuard-agency-secret-2026-change-me')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRE_HOURS = 24 * 7  # 7 dana

# Default credentials (seed on startup)
DEFAULT_USERNAME = 'getuard'
DEFAULT_PASSWORD = 'Getuard1994.'

app = FastAPI(title="Getuard Agency API")
api_router = APIRouter(prefix="/api")
security = HTTPBearer()


# ============== MODELS ==============

class LoginRequest(BaseModel):
    username: str
    password: str

class LoginResponse(BaseModel):
    access_token: str
    user: dict

class Agency(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    naziv: str = "ADVANCED ACCOUNTING"
    adresa: str = "Brajša bb, Ulcinj"
    grad: str = "Ulcinj"
    pib: str = ""
    pdv_broj: str = ""
    ziro_racun: str = ""
    banka: str = ""
    telefon: str = "+382 69 172 204"
    email: str = "Advanced.acct@hotmail.com"
    direktor_ime: str = "GETUARD CEKOVIQ"
    direktor_jmbg: str = "0806994223008"
    djelatnost: str = "Računovodstvene usluge"
    logo_url: str = ""

class Company(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    naziv: str
    naziv_skraceni: str = ""
    pib: str
    maticni_broj: str = ""
    pdv_broj: str = ""
    adresa: str = ""
    grad: str = ""
    djelatnost: str = ""
    sifra_djelatnosti: str = ""
    direktor_ime: str = ""
    direktor_jmbg: str = ""
    direktor_adresa: str = ""
    ziro_racun: str = ""
    banka: str = ""
    telefon: str = ""
    email: str = ""
    # Flagovi
    pdv_obveznik: bool = False
    ioppd_obveznik: bool = False
    aktivna: bool = True
    napomena: str = ""
    # IRMS status (auto-popunjavanje iz Poreske uprave CG)
    irms_status: str = ""  # "Registrovan", "U likvidaciji", "U stečaju", "Mirovanje poslovanja", ...
    irms_checked_at: str = ""  # ISO datum poslednje provjere
    datum_registracije: str = ""  # iz IRMS-a, YYYY-MM-DD
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class CompanyCreate(BaseModel):
    naziv: str
    pib: str
    naziv_skraceni: Optional[str] = ""
    maticni_broj: Optional[str] = ""
    pdv_broj: Optional[str] = ""
    adresa: Optional[str] = ""
    grad: Optional[str] = ""
    djelatnost: Optional[str] = ""
    sifra_djelatnosti: Optional[str] = ""
    direktor_ime: Optional[str] = ""
    direktor_jmbg: Optional[str] = ""
    direktor_adresa: Optional[str] = ""
    ziro_racun: Optional[str] = ""
    banka: Optional[str] = ""
    telefon: Optional[str] = ""
    email: Optional[str] = ""
    pdv_obveznik: Optional[bool] = False
    ioppd_obveznik: Optional[bool] = False
    aktivna: Optional[bool] = True
    napomena: Optional[str] = ""
    irms_status: Optional[str] = ""
    irms_checked_at: Optional[str] = ""
    datum_registracije: Optional[str] = ""

class Employee(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    ime: str
    prezime: str
    jmbg: str = ""
    licna_karta: str = ""
    adresa: str = ""
    grad: str = ""
    pozicija: str = ""
    strucna_sprema: str = ""
    plata_bruto: float = 0.0
    plata_neto: float = 0.0
    datum_pocetka: str = ""
    datum_kraja: str = ""
    datum_prestanka: str = ""  # datum prestanka radnog odnosa (odjava)
    vrsta_ugovora: str = "neodredjeno"  # odredjeno/neodredjeno
    radno_vrijeme: str = "puno"  # puno/skraceno
    telefon: str = ""
    email: str = ""
    aktivan: bool = True
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class EmployeeCreate(BaseModel):
    company_id: str
    ime: str
    prezime: str
    jmbg: Optional[str] = ""
    licna_karta: Optional[str] = ""
    adresa: Optional[str] = ""
    grad: Optional[str] = ""
    pozicija: Optional[str] = ""
    strucna_sprema: Optional[str] = ""
    plata_bruto: Optional[float] = 0.0
    plata_neto: Optional[float] = 0.0
    datum_pocetka: Optional[str] = ""
    datum_kraja: Optional[str] = ""
    datum_prestanka: Optional[str] = ""
    vrsta_ugovora: Optional[str] = "neodredjeno"
    radno_vrijeme: Optional[str] = "puno"
    telefon: Optional[str] = ""
    email: Optional[str] = ""
    aktivan: Optional[bool] = True

class DocumentGenerateRequest(BaseModel):
    template_filename: str
    company_id: str
    employee_id: Optional[str] = None
    custom_fields: Dict[str, str] = {}  # dodatna polja koja korisnik ručno popunjava


class AneksRequest(BaseModel):
    employee_id: str
    nova_vrsta_ugovora: str = "neodredjeno"  # neodredjeno/odredjeno
    novi_datum_kraja: Optional[str] = ""
    nova_plata_neto: Optional[float] = None
    nova_pozicija: Optional[str] = ""
    razlog: Optional[str] = ""
    update_employee: bool = True  # ažurirati i polja zaposlenog u bazi

class PaymentRecord(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    year: int
    month: int  # 1-12
    iznos: float
    placeno: bool = False
    datum_placanja: str = ""
    napomena: str = ""

class PaymentUpdate(BaseModel):
    placeno: bool
    datum_placanja: Optional[str] = ""
    iznos: Optional[float] = None
    napomena: Optional[str] = ""

class PDVRecord(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id: str
    year: int
    month: int
    pdv_predato: bool = False
    pdv_datum: str = ""
    pdv_broj: str = ""
    ioppd_predato: bool = False
    ioppd_datum: str = ""
    ioppd_broj: str = ""

class PDVUpdate(BaseModel):
    pdv_predato: Optional[bool] = None
    pdv_datum: Optional[str] = None
    pdv_broj: Optional[str] = None
    ioppd_predato: Optional[bool] = None
    ioppd_datum: Optional[str] = None
    ioppd_broj: Optional[str] = None


# ============== AUTH HELPERS ==============

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))
    except Exception:
        return False

def create_jwt(username: str) -> str:
    payload = {
        'sub': username,
        'exp': datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRE_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        username = payload.get('sub')
        if not username:
            raise HTTPException(401, "Neispravan token")
        return username
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token istekao")
    except jwt.PyJWTError:
        raise HTTPException(401, "Neispravan token")


# ============== REMINDERS / PODSJETNICI ==============

@api_router.get("/reminders/expiring-contracts")
async def expiring_contracts(days: int = 30, username: str = Depends(get_current_user)):
    """Vraća sve zaposlene sa određenim ugovorom čiji datum_kraja ističe u narednih N dana."""
    today = datetime.now(timezone.utc).date()
    limit_date = today + timedelta(days=days)
    
    employees = await db.employees.find(
        {"vrsta_ugovora": "odredjeno", "datum_kraja": {"$ne": "", "$exists": True}, "aktivan": True},
        {"_id": 0}
    ).to_list(2000)
    
    expiring = []
    for emp in employees:
        try:
            end_str = emp.get("datum_kraja", "")
            if not end_str:
                continue
            end_dt = datetime.fromisoformat(end_str.replace('Z', '')).date()
            days_left = (end_dt - today).days
            if -7 <= days_left <= days:  # od 7 dana isteklog do N dana u budućnosti
                emp_copy = dict(emp)
                emp_copy["days_left"] = days_left
                emp_copy["end_date_formatted"] = end_dt.strftime("%d.%m.%Y")
                expiring.append(emp_copy)
        except Exception:
            continue
    
    # Enrich sa nazivima firmi
    company_ids = list(set(e.get("company_id") for e in expiring if e.get("company_id")))
    if company_ids:
        companies = await db.companies.find({"id": {"$in": company_ids}}, {"_id": 0}).to_list(1000)
        cmap = {c["id"]: c for c in companies}
        for e in expiring:
            c = cmap.get(e.get("company_id"))
            e["company_naziv"] = c.get("naziv", "—") if c else "—"
            e["company_pib"] = c.get("pib", "") if c else ""
    
    # Sort by days_left ascending (most urgent first)
    expiring.sort(key=lambda e: e.get("days_left", 999))
    return expiring


# ============== STARTUP - SEED USER + AGENCY ==============

@app.on_event("startup")
async def startup_seed():
    # Seed default user
    user = await db.users.find_one({"username": DEFAULT_USERNAME}, {"_id": 0})
    if not user:
        await db.users.insert_one({
            "username": DEFAULT_USERNAME,
            "password_hash": hash_password(DEFAULT_PASSWORD),
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        logging.info(f"Seeded default user: {DEFAULT_USERNAME}")
    
    # Seed default agency
    agency = await db.agency.find_one({}, {"_id": 0})
    if not agency:
        default_agency = Agency().model_dump()
        await db.agency.insert_one(default_agency)
        logging.info("Seeded default agency")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()


# ============== AUTH ROUTES ==============

@api_router.post("/auth/login", response_model=LoginResponse)
async def login(data: LoginRequest):
    user = await db.users.find_one({"username": data.username}, {"_id": 0})
    if not user or not verify_password(data.password, user['password_hash']):
        raise HTTPException(401, "Pogrešno korisničko ime ili lozinka")
    token = create_jwt(data.username)
    return {"access_token": token, "user": {"username": data.username}}

@api_router.get("/auth/me")
async def me(username: str = Depends(get_current_user)):
    return {"username": username}


# ============== AGENCY ROUTES ==============

@api_router.get("/agency")
async def get_agency(username: str = Depends(get_current_user)):
    agency = await db.agency.find_one({}, {"_id": 0})
    if not agency:
        agency = Agency().model_dump()
        await db.agency.insert_one(agency)
    return agency

@api_router.put("/agency")
async def update_agency(data: Agency, username: str = Depends(get_current_user)):
    doc = data.model_dump()
    await db.agency.delete_many({})
    await db.agency.insert_one(dict(doc))
    return doc


# ============== IRMS LOOKUP ==============

@api_router.get("/companies/lookup-pib")
async def lookup_pib(pib: str, username: str = Depends(get_current_user)):
    """
    Automatski dohvat podataka firme iz IRMS portala Poreske uprave Crne Gore.
    Koristi javne API-je:
      1) GET /public/api/business-entities?identificationNumber={pib}  - search
      2) GET /public/api/business-entity/{taxpayerId}                  - detalji
      3) GET /public/api/business-entity/{taxpayerId}/ownership-roles  - direktori
    """
    pib = pib.strip()
    if not pib or not pib.isdigit() or len(pib) < 6:
        raise HTTPException(400, "PIB mora biti broj sa minimalno 6 cifara")
    
    result = {
        "success": False,
        "source": "IRMS",
        "pib": pib,
        "data": {},
        "message": ""
    }
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "sr-Latn-ME,sr;q=0.9,en;q=0.8",
        "Origin": "https://irms.tax.gov.me",
        "Referer": "https://irms.tax.gov.me/public/search-register/business-entities",
    }
    
    try:
        # 1) Pretraga po PIB-u
        search_url = f"https://irms.tax.gov.me/public/api/business-entities?page=1&perPage=5&identificationNumber={pib}"
        search_resp = requests.get(search_url, headers=headers, timeout=10)
        if search_resp.status_code != 200:
            result["message"] = f"IRMS portal vratio status {search_resp.status_code}"
            return result
        
        search_data = search_resp.json()
        results_list = search_data.get("results", [])
        if not results_list:
            result["message"] = "Firma sa ovim PIB-om nije pronađena u IRMS registru"
            return result
        
        taxpayer = results_list[0]
        taxpayer_id = taxpayer.get("taxpayerId")
        
        if not taxpayer_id:
            result["message"] = "IRMS odgovor ne sadrži taxpayerId"
            return result
        
        # 2) Detalji
        detail_url = f"https://irms.tax.gov.me/public/api/business-entity/{taxpayer_id}"
        detail_resp = requests.get(detail_url, headers=headers, timeout=10)
        detail = detail_resp.json() if detail_resp.status_code == 200 else {}
        
        # 3) Ownership roles (za direktora)
        direktor_ime = ""
        try:
            roles_url = f"https://irms.tax.gov.me/public/api/business-entity/{taxpayer_id}/ownership-roles?id={taxpayer_id}&page=1&perPage=25"
            roles_resp = requests.get(roles_url, headers=headers, timeout=8)
            if roles_resp.status_code == 200:
                roles_data = roles_resp.json()
                for role in roles_data.get("results", []):
                    role_name = (role.get("role") or "").lower()
                    if "izvršni direktor" in role_name or "direktor" in role_name:
                        first = role.get("name") or ""
                        last = role.get("lastname") or ""
                        direktor_ime = f"{first} {last}".strip()
                        if direktor_ime:
                            break
                # Fallback: ako nije direktor, uzmi ovlašćenog zastupnika
                if not direktor_ime:
                    for role in roles_data.get("results", []):
                        first = role.get("name") or ""
                        last = role.get("lastname") or ""
                        direktor_ime = f"{first} {last}".strip()
                        if direktor_ime:
                            break
        except Exception as e:
            logging.warning(f"IRMS ownership-roles fetch failed: {e}")
        
        # Mapiranje na company schema
        full_name = detail.get("fullName") or taxpayer.get("fullName", "")
        short_name = detail.get("shortName") or ""
        registration_number = detail.get("registrationNumber") or taxpayer.get("registrationNumber", "")
        
        # Šifra djelatnosti: "5610, Djelatnosti restorana..." → ("5610", "Djelatnosti restorana...")
        main_activity = detail.get("mainActivity") or taxpayer.get("mainActivity", "")
        sifra_djelatnosti = ""
        djelatnost_naziv = main_activity
        if main_activity and "," in main_activity:
            parts = main_activity.split(",", 1)
            potential_code = parts[0].strip()
            if potential_code.isdigit():
                sifra_djelatnosti = potential_code
                djelatnost_naziv = parts[1].strip()
        
        # Grad: "Ulcinj, Crna Gora" → "Ulcinj"
        city_raw = detail.get("city") or ""
        grad = city_raw.split(",")[0].strip() if city_raw else ""
        
        # Datum registracije: "11/19/2025 00:00:00" → "2025-11-19"
        datum_registracije = ""
        reg_date_raw = detail.get("registrationDate") or ""
        if reg_date_raw:
            try:
                # Format: "11/19/2025 00:00:00" (MM/DD/YYYY)
                date_part = reg_date_raw.split()[0]
                m, d, y = date_part.split("/")
                datum_registracije = f"{y}-{int(m):02d}-{int(d):02d}"
            except Exception:
                pass
        
        result["success"] = True
        result["data"] = {
            "naziv": full_name,
            "naziv_skraceni": short_name,
            "maticni_broj": registration_number,
            "pib": detail.get("identificationNumber") or taxpayer.get("identificationNumber", pib),
            "adresa": detail.get("address") or "",
            "grad": grad,
            "email": detail.get("email") or "",
            "telefon": detail.get("phoneNumber") or "",
            "website": detail.get("website") or "",
            "djelatnost": djelatnost_naziv,
            "sifra_djelatnosti": sifra_djelatnosti,
            "direktor_ime": direktor_ime,
            "oblik_organizovanja": detail.get("legalStatus") or "",
            "datum_registracije": datum_registracije,
            "status": detail.get("taxpayerStatusDisplayName") or "",
        }
        result["message"] = "Podaci uspješno preuzeti sa IRMS portala"
        return result
    
    except requests.RequestException as e:
        logging.error(f"IRMS request failed: {e}")
        result["message"] = "IRMS portal trenutno nedostupan. Probajte ponovo kasnije."
        return result
    except Exception as e:
        logging.error(f"IRMS lookup error: {e}")
        result["message"] = f"Greška pri obradi IRMS odgovora: {str(e)[:120]}"
        return result


# ============== COMPANIES ROUTES ==============

@api_router.get("/companies")
async def list_companies(
    search: Optional[str] = None,
    pdv_only: bool = False,
    ioppd_only: bool = False,
    username: str = Depends(get_current_user)
):
    query: Dict[str, Any] = {}
    if pdv_only:
        query["pdv_obveznik"] = True
    if ioppd_only:
        query["ioppd_obveznik"] = True
    if search:
        regex = re.escape(search)
        query["$or"] = [
            {"naziv": {"$regex": regex, "$options": "i"}},
            {"pib": {"$regex": regex, "$options": "i"}},
            {"direktor_ime": {"$regex": regex, "$options": "i"}},
        ]
    companies = await db.companies.find(query, {"_id": 0}).sort("naziv", 1).to_list(1000)
    return companies

@api_router.get("/companies/irms-alerts")
async def irms_alerts(username: str = Depends(get_current_user)):
    """Vraća listu firmi čiji IRMS status NIJE 'Registrovan' (npr. u likvidaciji, stečaju, mirovanje)."""
    cursor = db.companies.find(
        {
            "irms_status": {"$exists": True, "$ne": "", "$nin": ["Registrovan", ""]}
        },
        {"_id": 0, "id": 1, "naziv": 1, "pib": 1, "irms_status": 1, "irms_checked_at": 1}
    )
    return [doc async for doc in cursor]


@api_router.get("/companies/{company_id}")
async def get_company(company_id: str, username: str = Depends(get_current_user)):
    c = await db.companies.find_one({"id": company_id}, {"_id": 0})
    if not c:
        raise HTTPException(404, "Firma nije pronađena")
    return c

@api_router.post("/companies")
async def create_company(data: CompanyCreate, username: str = Depends(get_current_user)):
    # Check duplicate PIB
    existing = await db.companies.find_one({"pib": data.pib}, {"_id": 0})
    if existing:
        raise HTTPException(400, f"Firma sa PIB-om {data.pib} već postoji")
    company = Company(**data.model_dump())
    await db.companies.insert_one(company.model_dump())
    return company.model_dump()

@api_router.put("/companies/{company_id}")
async def update_company(company_id: str, data: CompanyCreate, username: str = Depends(get_current_user)):
    existing = await db.companies.find_one({"id": company_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Firma nije pronađena")
    updated = {**existing, **data.model_dump()}
    await db.companies.update_one({"id": company_id}, {"$set": data.model_dump()})
    return updated

@api_router.delete("/companies/{company_id}")
async def delete_company(company_id: str, username: str = Depends(get_current_user)):
    await db.companies.delete_one({"id": company_id})
    await db.employees.delete_many({"company_id": company_id})
    return {"success": True}


# ============== EMPLOYEES ROUTES ==============

@api_router.get("/employees")
async def list_employees(
    company_id: Optional[str] = None,
    search: Optional[str] = None,
    username: str = Depends(get_current_user)
):
    query: Dict[str, Any] = {}
    if company_id:
        query["company_id"] = company_id
    if search:
        regex = re.escape(search)
        query["$or"] = [
            {"ime": {"$regex": regex, "$options": "i"}},
            {"prezime": {"$regex": regex, "$options": "i"}},
            {"jmbg": {"$regex": regex, "$options": "i"}},
        ]
    employees = await db.employees.find(query, {"_id": 0}).sort("prezime", 1).to_list(2000)
    return employees

@api_router.get("/employees/{employee_id}")
async def get_employee(employee_id: str, username: str = Depends(get_current_user)):
    e = await db.employees.find_one({"id": employee_id}, {"_id": 0})
    if not e:
        raise HTTPException(404, "Zaposleni nije pronađen")
    return e

@api_router.post("/employees")
async def create_employee(data: EmployeeCreate, username: str = Depends(get_current_user)):
    # Validate company
    company = await db.companies.find_one({"id": data.company_id}, {"_id": 0})
    if not company:
        raise HTTPException(400, "Firma ne postoji")
    employee = Employee(**data.model_dump())
    await db.employees.insert_one(employee.model_dump())
    return employee.model_dump()

@api_router.put("/employees/{employee_id}")
async def update_employee(employee_id: str, data: EmployeeCreate, username: str = Depends(get_current_user)):
    existing = await db.employees.find_one({"id": employee_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Zaposleni nije pronađen")
    await db.employees.update_one({"id": employee_id}, {"$set": data.model_dump()})
    return {**existing, **data.model_dump()}

@api_router.delete("/employees/{employee_id}")
async def delete_employee(employee_id: str, username: str = Depends(get_current_user)):
    await db.employees.delete_one({"id": employee_id})
    return {"success": True}


# ============== PERSONS (centralna evidencija fizičkih lica) ==============

@api_router.get("/persons")
async def list_all_persons(
    search: Optional[str] = None,
    company_id: Optional[str] = None,
    username: str = Depends(get_current_user)
):
    """Vraća SVE zaposlene iz SVIH firmi sa pridruženim podacima o firmi."""
    query: Dict[str, Any] = {}
    if company_id:
        query["company_id"] = company_id
    if search:
        regex = re.escape(search)
        query["$or"] = [
            {"ime": {"$regex": regex, "$options": "i"}},
            {"prezime": {"$regex": regex, "$options": "i"}},
            {"jmbg": {"$regex": regex, "$options": "i"}},
            {"pozicija": {"$regex": regex, "$options": "i"}},
        ]
    
    employees = await db.employees.find(query, {"_id": 0}).sort("prezime", 1).to_list(5000)
    
    # Enrich sa nazivima firmi
    company_ids = list(set(e.get("company_id") for e in employees if e.get("company_id")))
    companies = await db.companies.find({"id": {"$in": company_ids}}, {"_id": 0}).to_list(1000)
    cmap = {c["id"]: c for c in companies}
    
    for e in employees:
        c = cmap.get(e.get("company_id"))
        e["company_naziv"] = c.get("naziv", "—") if c else "—"
        e["company_pib"] = c.get("pib", "") if c else ""
    
    return employees


# ============== TEMPLATES & DOCUMENT GENERATION ==============

@api_router.get("/templates")
async def list_templates(username: str = Depends(get_current_user)):
    """Vraća listu svih .docx, .doc, .pdf šablona u templates folderu."""
    templates = []
    for f in sorted(TEMPLATES_DIR.iterdir()):
        if f.is_file() and f.suffix.lower() in ['.docx', '.doc', '.pdf', '.rtf']:
            # Friendly name
            name = f.stem.replace('_', ' ').strip()
            # Capitalize words
            name = ' '.join(w.capitalize() if not w.isupper() else w for w in name.split())
            category = _categorize_template(f.name)
            templates.append({
                "filename": f.name,
                "name": name,
                "extension": f.suffix.lower(),
                "category": category,
                "supports_generation": f.suffix.lower() == '.docx'
            })
    return templates


def _categorize_template(filename: str) -> str:
    fl = filename.lower()
    if "ugovor" in fl:
        return "Ugovori"
    if "odluk" in fl:
        return "Odluke"
    if "obavjest" in fl or "obavest" in fl:
        return "Obavještenja"
    if "zahtjev" in fl or "zahtev" in fl:
        return "Zahtjevi"
    if "ovlasc" in fl or "punomoc" in fl or "ovlast" in fl:
        return "Ovlaštenja i punomoći"
    if "rjesenje" in fl or "rješenj" in fl:
        return "Rješenja"
    if "prijava" in fl:
        return "Prijave"
    if "izjava" in fl:
        return "Izjave"
    if "potvrda" in fl:
        return "Potvrde"
    if "saglasn" in fl:
        return "Saglasnosti"
    if "normativ" in fl:
        return "Normative"
    if "opoziv" in fl:
        return "Opozivi"
    if "obrazlozen" in fl:
        return "Obrazloženja"
    if "pisana ponuda" in fl:
        return "Pisane ponude"
    if "op obrazac" in fl:
        return "Obrasci"
    return "Ostalo"


def _format_date(date_str: str = "") -> str:
    """Formatira datum u DD.MM.YYYY"""
    if date_str:
        try:
            dt = datetime.fromisoformat(date_str.replace('Z', ''))
            return dt.strftime("%d.%m.%Y")
        except Exception:
            pass
    return datetime.now(timezone.utc).strftime("%d.%m.%Y")


# ============== SAMPLE VALUES MAPPING ==============
# Šabloni od korisnika sadrže konkretne podatke nekoliko "primjer" firmi.
# Kada se generiše dokument, sve te sample vrijednosti se zamijenjuju
# podacima izabrane firme/zaposlenog/agencije.

# Sample firme koje se pojavljuju u šablonima (sve se mapiraju na izabranu firmu):
SAMPLE_COMPANY_NAMES = [
    # Različite varijante kako se firma "CULT ULCINJ" pojavljuje u šablonima
    'DRUŠTVO SA OGRANIČENOM ODGOVORNOŠĆU "CULT ULCINJ" ZA TRGOVINU, UGOSTITELJSTVO I USLUGE EXPORT-IMPORT- ULCINJ',
    'DRUŠTVO SA OGRANIČENOM ODGOVORNOŠĆU "CULT ULCINJ" ZA TRGOVINU, UGOSTITELJSTVO I USLUGE "EXPORT-IMPORT" ULCINJ',
    'DOO "CULT ULCINJ"-ULCINJ',
    "DOO CULT ULCINJ-ULCINJ",
    "DOO CULT ULCINJ",
    "CULT ULCINJ",
    # MARINI GROUP
    'DRUŠTVO SA OGRANIČENOM ODGOVORNOŠĆU "MARINI GROUP" ULCINJ',
    "MARINI GROUP",
    # SUMA FRESH MARKET
    'DRUŠTVO SA OGRANIČENOM ODGOVORNOŠĆU "SUMA FRESH MARKET" - ULCINJ',
    'DRUŠTVO SA OGRANIČENOM ODGOVORNOŠĆU  "SUMA FRESH MARKET" ULCINJ',
    'DRUŠTVO SA OGRANIČENOM ODGOVORNOŠĆU "SUMA FRESH MARKET" ULCINJ',
    'DRUŠTVO SA OGRANIČENOM ODGOVORNOŠĆU "SUMA FRESH MARKET" -ULCINJ',
    "SUMA FRESH MARKET",
    # GONI COMPANY
    'DOO "GONI COMPANY" ZA PROIZVODNJU, PROMET I USLUGE, EXPORT - IMPORT ULCINJ',
    "GONI COMPANY",
    # SUR AFRODITA
    'PREDUZETNIK SINANI  ALIRAMI KOJI OBAVLJA  PRIVREDNU DJELATNOST  "SUR AFRODITA" ULCINJ',
    "SUR AFRODITA",
    # DARTI
    '"DARTI" D.O.O. ULCINJ',
    "DARTI",
    # FRIENDS CAFFE
    "DOO FRIENDS CAFFE ULCINJ",
    "FRIENDS CAFFE",
    # ELA&ART (OP OBRAZAC) - even though OP OBRAZAC is image-only, mapping is here for safety
    'DRUŠTVO SA OGRANIČENOM ODGOVORNOŠĆU ZA PROIZVODNJU, PROMET I USLUGE " ELA&ART " ULCINJ',
    'DRUŠTVO SA OGRANIČENOM ODGOVORNOŠĆU ZA PROIZVODNJU,',
    'PROMET I USLUGE " ELA&ART " ULCINJ',
    "ELA&ART",
]

# Sample PIBs koje treba zamijeniti (sa izabranom firmom)
SAMPLE_PIBS = ["03801969", "03796841", "03807851", "03663108", "03314367", "1906972223002"]

# Sample PDV brojevi
SAMPLE_PDV_NUMBERS = ["82/31-02356-8", "82/31-03288-7"]

# Sample telefoni
SAMPLE_PHONES = ["069832886", "069688102", "069628880"]

# Sample šifre djelatnosti
SAMPLE_DJELATNOST_CODES = ["4334", "5610", "4711"]

# Sample direktori (zamjenjuju se sa company.direktor_ime)
SAMPLE_DIRECTORS = [
    "JUSUF ELEZAGIĆ", "JUSUF ELEZAGIC",
    "ARIAN MARINI",
    "VESEL SUMA",
    "ALIRAMI SINANI", "SINANI ALIRAMI",
    "ZIJA DODIĆ", "ZIJA DODIC",
]

# Sample JMBG direktora
SAMPLE_DIRECTOR_JMBGS = [
    "0303987220166",
    "3105998220014",
    "3004985220014",
    "3004974220012",
]

# Sample adrese firmi
SAMPLE_COMPANY_ADDRESSES = [
    "Ulcinj, Ul.Vellezerit Frasheri bb.",
    "UL.VELLEZERIT FRASHERI BB ULCINJ",
    "UL.VLLEZERIT FRASHERI BB ULCINJ",
    "UL.VELLEZERIT FRASHERI BB",
    "VELLEZERIT FRASHERI BB",
    "VELIKA PLAZA BB - ULCINJ",
    "VLADIMIR BB. ULCINJ 85366",
    "VLADIMIR BB",
    "VLADIMIR   bb",
    "VLADIMIR BB ULCINJ",
    "DJERANE BB",
]

# Sample matični/registracijski brojevi
SAMPLE_REG_NUMBERS = ["5-1354657/001", "5-1344978"]

# Sample agency data (UVIJEK se zamjenjuju agencijskim podacima iz postavki)
# Agencija u šablonima može biti "Getuard Cekoviq" ili "Advanced Accounting" (D.O.O.)
SAMPLE_AGENCY_NAMES = [
    "D.O.O. ADVANCED ACCOUNTING- ULCINJ",
    "D.O.O. ADVANCED ACCOUNTING - ULCINJ",
    "DOO ADVANCED ACCOUNTING ULCINJ",
    "ADVANCED ACCOUNTING ULCINJ",
]
SAMPLE_AGENCY_PIBS = ["03719073"]
SAMPLE_AGENCY_DIRECTOR_NAMES = [
    "CEKOVIQ GETUARD", "GETUARD CEKOVIQ",
    "MIRSADA CEKOVIC", "MIRSADA CEKOVIQ",
]
SAMPLE_AGENCY_JMBGS = ["0806994223008", "2603972228013"]
SAMPLE_AGENCY_ADDRESSES = ["Ulcinja, Brajša bb.", "Brajša bb."]

# Sample zaposleni (zamjenjuju se izabranim zaposlenim)
SAMPLE_EMPLOYEE_NAMES = [
    "ALEKSANDER CUROVIĆ", "ALEKSANDER CUROVIC",
    "RENATO JAKU",
    "ZIJA DODIĆ", "ZIJA DODIC",
    "ALBERT OSMANOVIC", "ALBERT OSMANOVIĆ",
]
SAMPLE_EMPLOYEE_JMBGS = [
    "1411008223029", "039066621", "3004974220012",
    "0612986223008",
]
SAMPLE_EMPLOYEE_LK = ["I3382349M"]  # broj lične karte
SAMPLE_EMPLOYEE_POSITIONS = [
    "KONOBAR", "Konobar", "konobar",
    "KUVAR", "Kuvar", "kuvar",
    "pomoćni radnik u gradjevinu",
    "pomocni radnik u gradjevinu",
    "NK – nekvalifikovani radnik",
    "NK - nekvalifikovani radnik",
]

# Sample datumi početka rada koji se zamjenjuju sa emp.datum_pocetka
# (datum zasnivanja radnog odnosa, datum stupanja na rad, datum zaključenja ugovora)
SAMPLE_EMPLOYEE_START_DATES = [
    "09.02.2026",  # u UGOVOR O RADU Zaposlenih.docx
    "19.11.2025",  # u UGOVOR O RADU DIREKTOR.docx
    "01.02.2026",  # u UGOVOR O DOPUNSKOM RADU.docx (3x)
]

# Specifični datumi/periodi/dani koji se BRIŠU iz dokumenata
# (klijent ručno popuni u Wordu/PDF-u prema svojim potrebama)
SAMPLE_PERIODS_TO_BLANK = {
    # Periodi godišnjeg/sedmičnog odmora i pauze - briše se da klijent sam popuni
    "01.01.2026-31.12.2026": "________________________",
    "01.10.2026-31.10.2026": "________________________",
    "01.01.2026.godine": "_________ godine",
    # Specifični datumi koji NISU referenca na zakon
    "02.02.2026 god.": "______________ god.",
    # Specifična vremena pauze
    "10:00-10:30h": "____________",
    "10:00-10:30": "____________",
    # Specifični dan sedmičnog odmora - klijent bira po zaposlenom
    "NEDELJA": "____________",
    # Smjene u rasporedu (specifična satnica)
    "07:00  do 15:00  h": "______ do ______ h",
    "15:00  do_24:00  h": "______ do ______ h",
    "_07:00  do 15:00": "______ do ______",
    "_07:00": "______",
    "do_24:00": "do ______",
}


def _build_replacements(company: dict, employee: Optional[dict], agency: dict, custom: dict, template_filename: str = "") -> Dict[str, str]:
    """Gradi dictionary svih mogućih placeholdera za zamjenu."""
    today = datetime.now(timezone.utc)
    today_str = today.strftime("%d.%m.%Y")
    
    company_naziv = company.get("naziv", "")
    company_pib = company.get("pib", "")
    company_grad = company.get("grad", "") or "Ulcinj"
    company_adresa = company.get("adresa", "")
    full_adresa = f"{company_adresa}, {company_grad}" if company_adresa and company_grad else (company_adresa or company_grad)
    
    direktor_ime = company.get("direktor_ime", "") or "________________"
    direktor_jmbg = company.get("direktor_jmbg", "") or "________________"
    
    agency_director = agency.get("direktor_ime", "")
    agency_jmbg = agency.get("direktor_jmbg", "")
    agency_adresa = f"{agency.get('adresa','')}".strip() or "Brajša bb."
    
    emp_full = ""
    emp_jmbg = ""
    emp_pozicija = ""
    emp_grad = ""
    if employee:
        emp_full = f"{employee.get('ime','')} {employee.get('prezime','')}".strip()
        emp_jmbg = employee.get("jmbg", "")
        emp_pozicija = employee.get("pozicija", "")
        emp_grad = employee.get("grad", "") or "Ulcinju"
    
    repl = {}
    
    # ========== SMART REPLACEMENT - Sample → Real ==========
    # Sample company names → real company
    for sample_name in SAMPLE_COMPANY_NAMES:
        if sample_name and company_naziv:
            repl[sample_name] = company_naziv
    
    # Sample PIBs → real PIB
    for sample_pib in SAMPLE_PIBS:
        if company_pib:
            repl[sample_pib] = company_pib
    
    # Sample directors → real director
    for sample_dir in SAMPLE_DIRECTORS:
        if direktor_ime and direktor_ime != "________________":
            repl[sample_dir] = direktor_ime
    
    # Razdvojeno ime/prezime direktora za templote koji ih traže odvojeno
    # (npr. Zahtjev iz kaznene evidencije fizičko lice)
    if direktor_ime and direktor_ime != "________________":
        parts = direktor_ime.strip().split(maxsplit=1)
        dir_first = parts[0] if parts else ""
        dir_last = parts[1] if len(parts) > 1 else ""
        if dir_first and dir_last:
            # "VESEL" (ime) i "SUMA" (prezime) standalone → koristi pravo ime/prezime
            # Pazi: SAMPLE_DIRECTORS sortira po dužini desc, "VESEL SUMA" se zamjenjuje PRIJE "VESEL"
            repl["VESEL"] = dir_first
            repl["SUMA"] = dir_last
    
    # Sample director JMBGs → real
    for sample_jmbg in SAMPLE_DIRECTOR_JMBGS:
        if direktor_jmbg and direktor_jmbg != "________________":
            repl[sample_jmbg] = direktor_jmbg
    
    # Sample addresses → real
    for sample_addr in SAMPLE_COMPANY_ADDRESSES:
        if company_adresa:
            repl[sample_addr] = full_adresa
    
    # Sample reg numbers + datum rješenja CRPS
    for sample_reg in SAMPLE_REG_NUMBERS:
        if company.get("maticni_broj"):
            repl[sample_reg] = company["maticni_broj"]
    # Datum rješenja CRPS - ako firma ima, koristi, inače blank
    repl["17.12.2025"] = company.get("datum_registracije") or "____________"
    # Datum CRPS rješenja iz Prijave zanatstva: "5-1344978  23.10.2025"
    repl["23.10.2025"] = company.get("datum_registracije") or "____________"
    
    # Šifra djelatnosti - sample "4711" iz Prijave trgovine + "4334", "5610" iz drugih
    if company.get("sifra_djelatnosti"):
        for sd_sample in SAMPLE_DJELATNOST_CODES:
            repl[sd_sample] = company["sifra_djelatnosti"]
    
    # Naziv djelatnosti
    if company.get("djelatnost"):
        repl["Bojenje i zastakljivanje"] = company["djelatnost"]
        repl["Trgovina na malo u nespecijalizovanim prodavnicama,pretežno hranom,pićem i duvanom"] = company["djelatnost"]
    
    # Žiro račun - sample iz Prijave trgovine i Prijave zanatstva
    if company.get("ziro_racun"):
        repl["535-26292-64"] = company["ziro_racun"]
        repl["530-797915-34"] = company["ziro_racun"]
    
    # PDV broj
    if company.get("pdv_broj"):
        for sample_pdv in SAMPLE_PDV_NUMBERS:
            repl[sample_pdv] = company["pdv_broj"]
    
    # Telefon - prvo company, ako nema onda agency
    company_tel = company.get("telefon") or agency.get("telefon", "")
    if company_tel:
        repl["+382 69 172 204"] = company_tel
        repl["069 172 204"] = company_tel
        # Sample telefoni iz različitih šablona
        for sample_phone in SAMPLE_PHONES:
            repl[sample_phone] = company_tel
    
    # Email - prvo company, ako nema onda agency
    company_email = company.get("email") or agency.get("email", "")
    if company_email:
        repl["Advanced.acct@hotmail.com"] = company_email
        repl["advanced.acct@hotmail.com"] = company_email
        repl["restauranculto@gmail.com"] = company_email
    
    # Datum rođenja direktora - ako firma ima, ostaje 30.04.1985 za korisnika da popuni ručno
    # (Nemamo to polje u modelu trenutno)
    repl["30.04.1985"] = "____________"
    
    # Ime oca/majke direktora - nema u DB, ostavi blank
    repl["QAMIL"] = "________________"
    repl["NADIRE"] = "________________"
    
    # Mjesto/opština rođenja direktora - nema u DB
    # "BAR" se javlja samo u kontekstu mjesta/opštine rođenja u Zahtjevu iz kaznene evidencije
    # ne diraj ostale upotrebe BAR. (Ostavi za korisnika.)
    
    # Naziv objekta (samo prvi varijant - tačan tekst iz šablona)
    if company.get("naziv_skraceni") or company.get("naziv"):
        obj_short = company.get("naziv_skraceni") or company.get("naziv", "")
        repl["LOUNGE BAR CULT"] = obj_short
    
    # Tipografski tipfeleri iz konverzije PDF→DOCX (UCLINJ → ULCINJ)
    if company_grad:
        repl["UCLINJ"] = company_grad
    
    # Agency name + PIB + director - always replace samples with current agency data
    agency_naziv = agency.get("naziv", "")
    agency_pib = agency.get("pib", "")
    for sample_ag_name in SAMPLE_AGENCY_NAMES:
        if agency_naziv:
            repl[sample_ag_name] = agency_naziv
    for sample_ag_pib in SAMPLE_AGENCY_PIBS:
        if agency_pib:
            repl[sample_ag_pib] = agency_pib
    for sample_ag in SAMPLE_AGENCY_DIRECTOR_NAMES:
        if agency_director:
            repl[sample_ag] = agency_director
    for sample_ag_jmbg in SAMPLE_AGENCY_JMBGS:
        if agency_jmbg:
            repl[sample_ag_jmbg] = agency_jmbg
    for sample_ag_addr in SAMPLE_AGENCY_ADDRESSES:
        if agency_adresa:
            repl[sample_ag_addr] = agency_adresa
    
    # Employee samples → real employee (only if selected)
    if employee and emp_full:
        for sample_emp in SAMPLE_EMPLOYEE_NAMES:
            repl[sample_emp] = emp_full
        for sample_emp_jmbg in SAMPLE_EMPLOYEE_JMBGS:
            if emp_jmbg:
                repl[sample_emp_jmbg] = emp_jmbg
        if emp_pozicija:
            for sample_pos in SAMPLE_EMPLOYEE_POSITIONS:
                # Don't replace DIREKTOR with employee position (DIREKTOR refers to company director)
                if sample_pos.upper() != "DIREKTOR":
                    repl[sample_pos] = emp_pozicija
        # Broj lične karte zaposlenog
        emp_lk = employee.get("licna_karta", "")
        if emp_lk:
            for sample_lk in SAMPLE_EMPLOYEE_LK:
                repl[sample_lk] = emp_lk
        # Datum zasnivanja radnog odnosa / stupanja na rad / zaključenja ugovora
        # → uzima se iz emp.datum_pocetka (kad je upisan u formi)
        emp_start = employee.get("datum_pocetka", "")
        emp_end = employee.get("datum_kraja", "")
        vrsta = (employee.get("vrsta_ugovora") or "neodredjeno").lower()
        
        formatted_start = ""
        formatted_end = ""
        if emp_start:
            try:
                dt = datetime.fromisoformat(emp_start.replace('Z', ''))
                formatted_start = dt.strftime("%d.%m.%Y")
            except Exception:
                formatted_start = emp_start
        if emp_end:
            try:
                dt = datetime.fromisoformat(emp_end.replace('Z', ''))
                formatted_end = dt.strftime("%d.%m.%Y")
            except Exception:
                formatted_end = emp_end
        
        # Konstruktor dinamičke fraze "određeno/neodređeno vrijeme rada i to od ..."
        if formatted_start:
            if vrsta == "odredjeno":
                end_part = formatted_end if formatted_end else "____________"
                contract_phrase = f"određeno vrijeme rada i to od  {formatted_start} - {end_part} godine"
            else:
                contract_phrase = f"neodređeno vrijeme rada i to od  {formatted_start} godine"
            
            # Zamjeni obje varijante iz šablona sa dinamičkom frazom
            repl["određeno vrijeme rada i to od  09.02.2026 -31.12.2026 godine"] = contract_phrase
            repl["neodređeno vrijeme rada i to od  19.11.2025 godine"] = contract_phrase
            
            # Dopunski rad: "period od 01.02.2026  i važi do 31.12.2026"
            if vrsta == "odredjeno":
                end_part2 = formatted_end if formatted_end else "____________"
                repl["period od 01.02.2026  i važi do 31.12.2026"] = f"period od {formatted_start}  i važi do {end_part2}"
            else:
                repl["period od 01.02.2026  i važi do 31.12.2026"] = f"period od {formatted_start} (na neodređeno vrijeme)"
        
        # Pojedinačni datumi zaposlenog (datum stupanja, datum zaključenja itd.)
        if formatted_start:
            for sample_date in SAMPLE_EMPLOYEE_START_DATES:
                repl[sample_date] = formatted_start
        # End-of-contract period blank/datum_kraja
        if formatted_end:
            repl["-31.12.2026 godine"] = f"- {formatted_end} godine"
            repl["važi do 31.12.2026"] = f"važi do {formatted_end}"
        else:
            repl["-31.12.2026 godine"] = "- ____________ godine"
            repl["važi do 31.12.2026"] = "važi do ____________"
        
        # Plata zaposlenog → uzima se iz forme (emp.plata_neto)
        emp_plata_neto = employee.get("plata_neto") or 0
        if emp_plata_neto > 0:
            plata_str = f"{float(emp_plata_neto):.2f}"
            # UGOVOR O RADU Zaposlenih/Direktor: "neto iznosu od 600.00 euro"
            repl["neto iznosu od 600.00 euro"] = f"neto iznosu od {plata_str} euro"
            repl["600.00 euro"] = f"{plata_str} euro"
            # UGOVOR O DOPUNSKOM RADU: "iznos od 300.00 eura"
            repl["iznos od 300.00 eura"] = f"iznos od {plata_str} eura"
            repl["300.00 eura"] = f"{plata_str} eura"
        
        # Datum prestanka radnog odnosa (odjava)
        emp_prestanak = employee.get("datum_prestanka", "")
        formatted_prestanak = ""
        if emp_prestanak:
            try:
                dt = datetime.fromisoformat(emp_prestanak.replace('Z', ''))
                formatted_prestanak = dt.strftime("%d.%m.%Y")
            except Exception:
                formatted_prestanak = emp_prestanak
            repl["[DATUM_PRESTANKA]"] = formatted_prestanak
            # Datum prestanka u rješenju o prestanku i obrazloženju za kašnjenje odjave
            # Sample datumi koji predstavljaju prestanak radnog odnosa
            repl["[DATUM_ODJAVE]"] = formatted_prestanak
        
        # POJEDINAČNO OBAVJESTENJE / ostali blank zaposlenog placeholderi
        for blank_zap in [
            "Zaposleni:________________________",
            "Zaposleni: ________________________",
            "Zaposlenom  __________________",
            "Zaposlenom __________________",
        ]:
            repl[blank_zap] = f"Zaposleni: {emp_full}"
        # Izjava o pravima/obavezama: "Ime i prezime: __________"
        for blank_imepr in [
            "Ime i prezime: ________________________",
            "Ime i prezime:________________________",
            "Ime i prezime: ____________________",
            "Ime i prezime:____________________",
        ]:
            repl[blank_imepr] = f"Ime i prezime: {emp_full}"
        
        if emp_jmbg:
            for blank_jmbg in [
                "JMB: _____________________",
                "JMB:_____________________",
                "JMBG: _____________________",
                "JMBG:  __________________",
                "JMBG: __________________",
            ]:
                repl[blank_jmbg] = f"JMBG: {emp_jmbg}"
        
        if emp_pozicija:
            for blank_pos in [
                "Radno mjesto: ____________________",
                "Radno mjesto:____________________",
                "radno mjesto:__________",
                "radno mjesto: __________",
                "Radno mjesto: ___________",
                "Radno mjesto:___________",
            ]:
                repl[blank_pos] = f"Radno mjesto: {emp_pozicija}"
            # Dodatne pozicije iz RJESENJE O PRESTANKU
            repl["pomocni radnik"] = emp_pozicija.lower() if emp_pozicija else "pomocni radnik"
        
        # Datum stupanja na rad - IZJAVA o pravima i obavezama
        if formatted_start:
            for blank_ds in [
                "Datum stupanja na rad: _______________",
                "Datum stupanja na rad:_______________",
            ]:
                repl[blank_ds] = f"Datum stupanja na rad: {formatted_start}"
        
        # Datum prestanka radnog odnosa - sample datumi u Rješenju o prestanku
        # ako je upisan datum_prestanka, koristi taj; inače današnji datum
        prestanak_date = formatted_prestanak if formatted_prestanak else today_str
        # Sample datumi prestanka u šablonima
        repl["31.03.2026"] = prestanak_date
        repl["28.02.2026"] = prestanak_date
    
    # Brisanje specifičnih datuma/periode/dana - klijent ručno popuni
    for sample_period, blank in SAMPLE_PERIODS_TO_BLANK.items():
        repl[sample_period] = blank
    
    # Header datumi u dokumentima ("Ulcinj, 01.01.2026 god.") → grad firme + današnji datum
    header_city = company_grad or "Ulcinj"
    repl["Ulcinj, 01.01.2026 god."] = f"{header_city}, {today_str} god."
    repl["Ulcinj, 02.02.2026 god."] = f"{header_city}, {today_str} god."
    repl["Ulcinj, 02.02.2026"] = f"{header_city}, {today_str}"
    repl["Ulcinj, 16.02.2026"] = f"{header_city}, {today_str}"
    repl["Ulcinj, 16.02.2026 godine"] = f"{header_city}, {today_str} godine"
    repl["Ulcinj, 02.04.2026 god."] = f"{header_city}, {today_str} god."
    repl["Ulcinj, 02.04.2026"] = f"{header_city}, {today_str}"
    repl["U ULCINJ, dana 02.06.2026 godine."] = f"U {header_city}, dana {today_str} godine."
    repl["U ULCINJ, dana 02.06.2026 godine"] = f"U {header_city}, dana {today_str} godine"
    repl["02.06.2026"] = today_str
    repl["U VLADIMIR, dana 01.03.2026  godine"] = f"U {header_city}, dana {today_str} godine"
    repl["U VLADIMIR, dana 01.03.2026 godine"] = f"U {header_city}, dana {today_str} godine"
    repl["dana 01.03.2026"] = f"dana {today_str}"
    # Standalone datumi koji su sample za današnji datum
    repl[" 01.03.2026 god."] = f" {today_str} god."
    repl[" 16.02.2026"] = f" {today_str}"
    repl["04.05.2026"] = today_str  # punomocje token
    
    # ========== MSG 292: Datumi koji se uvijek setuju na današnji (datum štampe) ==========
    # OP OBRAZAC: "PODGORICA, 18.05.2026 godine" → "PODGORICA, [danas] godine"
    repl["PODGORICA, 18.05.2026 godine"] = f"PODGORICA, {today_str} godine"
    # OP OBRAZAC: "UP I 02/02-057/2026-34002/2" → blank (broj rješenja)
    repl["UP I 02/02-057/2026-34002/2"] = "________________"
    # Prijava zanatstva: "31.10.2025" → današnji (datum prijave i ispunjenosti uslova)
    repl["31.10.2025"] = today_str
    # Prijava zanatstva: "Br./Nr.: 08- 306" → "Br./Nr.: 08- ___"
    repl["Br./Nr.: 08- 306"] = "Br./Nr.: 08- _____"
    # Odluka o blagajničkom maksimumu: "dana 02.02.2026 donosi" → "dana [danas] donosi"
    repl["dana 02.02.2026 donosi"] = f"dana {today_str} donosi"
    # Odluka za popust u prodavnicu: "dana 21.05.2026 god. donos" → "dana [danas] god. donosi"
    # Note: ovo je već pokriveno kroz "dana 01.03.2026" mapiranje gore, ali za svaki slučaj:
    repl["dana 01.01.2026 god."] = f"dana {today_str} god."
    repl["dana 02.02.2026 god."] = f"dana {today_str} god."
    repl["dana 16.02.2026 god."] = f"dana {today_str} god."
    
    # Broj broja dokumenta - ostavi blank za korisnika
    repl["BR:10/2026"] = "BR: ___/2026"
    
    # ========== BLANK PLACEHOLDERS (underscore lines) ==========
    # NAPOMENA: Ovi generički blank-line replacements se NE primenjuju na šablone
    # koji koriste eksplicitne (NAZIV_FIRME) placeholdere (npr. Zahtjev za uzorkovanje)
    # — jer bi short-key replacement pokrio dio long-underscore linije i ostavio remnant.
    _tn_lower_pre = (template_filename or "").lower()
    skip_legacy_blanks = "uzorkovanje" in _tn_lower_pre
    
    if company_naziv and not skip_legacy_blanks:
        for blank_naziv in [
            "NAZIV FIRME:____________________________",
            "NAZIV FIRME: ____________________________",
            "Naziv firme:_________________",
            "Naziv firme: _________________",
        ]:
            repl[blank_naziv] = f"NAZIV FIRME: {company_naziv}"
    
    if company_pib and not skip_legacy_blanks:
        for blank_pib in [
            "PIB: _______________________",
            "PIB:_______________________",
            "PIB: ______________________",
        ]:
            repl[blank_pib] = f"PIB: {company_pib}"
    
    if company_adresa and not skip_legacy_blanks:
        full_adr = f"{company_adresa}, {company_grad}" if company_adresa and company_grad else (company_adresa or company_grad)
        for blank_adr in [
            "Adresa: _____________________",
            "Adresa:_____________________",
            "Adresa: Ulcinj",
        ]:
            repl[blank_adr] = f"Adresa: {full_adr}"
    
    # Datum današnji za blank polje "Datum: ___"
    for blank_date in [
        "Datum: ________________",
        "Datum:________________",
        "Datum: _____________________",
        "Datum:_____________________",
    ]:
        repl[blank_date] = f"Datum: {today_str}"
    
    # Broj dokumenta - blank ostaje (korisnik popuni)
    # Ali sample iz odluke o popustu i sl. ostaje
    
    # Žiro račun u ODLUCI O PODIZANJU NOVCA
    if company.get("ziro_racun"):
        repl["sa žiro računa  društva  broj:_______________"] = f"sa žiro računa društva broj: {company['ziro_racun']}"
        repl["broj:_______________"] = f"broj: {company['ziro_racun']}"
    
    # ========== ALSO support [PLACEHOLDER] syntax for future templates ==========
    repl.update({
        # FIRMA - klijent
        "[NAZIV_FIRME]": company.get("naziv", ""),
        "[NAZIV_FIRME_SKRACENO]": company.get("naziv_skraceni") or company.get("naziv", ""),
        "[PIB_FIRME]": company.get("pib", ""),
        "[JIB_FIRME]": company.get("pib", ""),
        "[MATICNI_BROJ_FIRME]": company.get("maticni_broj", ""),
        "[PDV_BROJ_FIRME]": company.get("pdv_broj", ""),
        "[ADRESA_FIRME]": company.get("adresa", ""),
        "[GRAD_FIRME]": company.get("grad", ""),
        "[DJELATNOST_FIRME]": company.get("djelatnost", ""),
        "[SIFRA_DJELATNOSTI]": company.get("sifra_djelatnosti", ""),
        "[DIREKTOR_IME]": company.get("direktor_ime", ""),
        "[DIREKTOR_JMBG]": company.get("direktor_jmbg", ""),
        "[DIREKTOR_ADRESA]": company.get("direktor_adresa", "") or company.get("adresa", ""),
        "[ZIRO_RACUN_FIRME]": company.get("ziro_racun", ""),
        "[BANKA_FIRME]": company.get("banka", ""),
        "[TELEFON_FIRME]": company.get("telefon", ""),
        "[EMAIL_FIRME]": company.get("email", ""),
        
        # AGENCIJA
        "[NAZIV_AGENCIJE]": agency.get("naziv", ""),
        "[ADRESA_AGENCIJE]": agency.get("adresa", ""),
        "[GRAD_AGENCIJE]": agency.get("grad", ""),
        "[PIB_AGENCIJE]": agency.get("pib", ""),
        "[DIREKTOR_AGENCIJE]": agency.get("direktor_ime", ""),
        "[JMBG_AGENCIJE]": agency.get("direktor_jmbg", ""),
        
        # DATUMI
        "[DATUM_DANAS]": today.strftime("%d.%m.%Y"),
        "[DATUM]": today.strftime("%d.%m.%Y"),
        "[GODINA]": str(today.year),
        "[MJESEC]": str(today.month),
        "[DAN]": str(today.day),
    })
    
    if employee:
        repl.update({
            "[IME_RADNIKA]": employee.get("ime", ""),
            "[PREZIME_RADNIKA]": employee.get("prezime", ""),
            "[IME_PREZIME_RADNIKA]": f"{employee.get('ime','')} {employee.get('prezime','')}".strip(),
            "[JMBG_RADNIKA]": employee.get("jmbg", ""),
            "[LICNA_KARTA_RADNIKA]": employee.get("licna_karta", ""),
            "[ADRESA_RADNIKA]": employee.get("adresa", ""),
            "[GRAD_RADNIKA]": employee.get("grad", ""),
            "[POZICIJA_RADNIKA]": employee.get("pozicija", ""),
            "[STRUCNA_SPREMA]": employee.get("strucna_sprema", ""),
            "[PLATA_BRUTO]": f"{employee.get('plata_bruto', 0):.2f}",
            "[PLATA_NETO]": f"{employee.get('plata_neto', 0):.2f}",
            "[DATUM_POCETKA_RADA]": _format_date(employee.get("datum_pocetka", "")),
            "[VRSTA_UGOVORA]": employee.get("vrsta_ugovora", ""),
            "[RADNO_VRIJEME]": employee.get("radno_vrijeme", ""),
            "[TELEFON_RADNIKA]": employee.get("telefon", ""),
        })
    
    # Custom fields od korisnika
    for k, v in custom.items():
        key = k if k.startswith("[") else f"[{k}]"
        repl[key] = str(v)
    
    # ========== MSG 292: Template-specifični prepisivi ==========
    tname_lower = (template_filename or "").lower()
    
    # "Rješenje o korišćenju godišnjeg odmora" → datum štampe ne treba (klijent popunjava ručno)
    if "rjesenje" in tname_lower and ("godisnj" in tname_lower or "godišnj" in tname_lower):
        # Resetuj sve današnje datume u headerima na blank
        repl[f"{header_city}, {today_str} god."] = f"{header_city}, ________________ god."
        repl[f"{header_city}, {today_str} godine"] = f"{header_city}, ________________ godine"
        repl[f"{header_city}, {today_str}"] = f"{header_city}, ________________"
        # "Datum: 21.05.2026" (već popunjeno iz blank field) → "Datum: ____"
        repl[f"Datum: {today_str}"] = "Datum: ________________"
    
    # "Rješenje o prestanku radnog odnosa kad ističe ugovor o radu" → datum štampe = today;
    # datum prestanka rada = employee.datum_prestanka (već mapirano kroz `prestanak_date`)
    # Ako je ovo termination rješenje a nema datum_prestanka, koristi datum_kraja
    if "prestan" in tname_lower and employee:
        emp_prestanak2 = employee.get("datum_prestanka") or employee.get("datum_kraja")
        if emp_prestanak2:
            try:
                dt = datetime.fromisoformat(emp_prestanak2.replace('Z',''))
                fp = dt.strftime("%d.%m.%Y")
                repl["31.03.2026"] = fp
                repl["28.02.2026"] = fp
            except Exception:
                pass
    
    # "Obrazloženje za poresku upravu kad kasnimo sa odjavama" → datum prestanka = employee.datum_prestanka
    if "obrazlozenje" in tname_lower and employee:
        emp_prestanak2 = employee.get("datum_prestanka") or employee.get("datum_kraja")
        if emp_prestanak2:
            try:
                dt = datetime.fromisoformat(emp_prestanak2.replace('Z',''))
                fp = dt.strftime("%d.%m.%Y")
                repl["31.03.2026"] = fp
                repl["28.02.2026"] = fp
            except Exception:
                pass
    
    # "Zahtjev iz kaznene evidencije za fizičko lice" → ako je employee_id naveden,
    # SUBJEKT je taj zaposleni (a NE direktor firme).
    if "kaznene evidencije fizicko" in tname_lower and employee and emp_full:
        emp_parts = emp_full.strip().split(maxsplit=1)
        emp_first = emp_parts[0] if emp_parts else ""
        emp_last = emp_parts[1] if len(emp_parts) > 1 else ""
        if emp_first and emp_last:
            # Override direktor mappings za ovaj specifičan šablon
            repl["VESEL"] = emp_first
            repl["SUMA"] = emp_last
            repl["VESEL SUMA"] = emp_full
        # Adresa zaposlenog umjesto direktora
        emp_adresa = employee.get("adresa", "")
        if emp_adresa:
            repl["VLADIMIR BB. ULCINJ 85366"] = emp_adresa
            repl["VLADIMIR BB"] = emp_adresa
        # JMBG zaposlenog
        if emp_jmbg:
            repl["3004985220014"] = emp_jmbg
    
    # "Prijava zanatstva" → label-anchored replacements za polja sa blank-line vrijednostima
    # (pdf2docx je sačuvao layout ali izbrisao dummy vrijednosti; popunjavamo nakon naziva polja)
    if "prijava_zanatstva" in tname_lower or "prijava zanatstva" in tname_lower:
        # 1.1. Naziv/ime/Emri _____...
        if company_naziv:
            repl["1.1. Naziv/ime/Emri ________________________________________________________________"] = \
                f"1.1. Naziv/ime/Emri  {company_naziv}"
        # Sjedište + adresa
        if company_adresa or company_grad:
            sj_adr = f"{company_grad or 'Ulcinj'}  adresa: {company_adresa}" if company_adresa else (company_grad or "")
            repl["a. Sjedište/Selia _____________________ adresa__________________________________________"] = \
                f"a. Sjedište/Selia  {company_grad}  adresa: {company_adresa or '____'}"
            repl["3.1. Sjedište/Selia________________________ adresa:______________________________________________"] = \
                f"3.1. Sjedište/Selia  {company_grad}  adresa: {company_adresa or '____'}"
        # 1.4. Šifra djelatnosti
        if company.get("sifra_djelatnosti"):
            repl["1.4. Šifra djelatnosti/Shifra e aktivitetit \t________________________________________"] = \
                f"1.4. Šifra djelatnosti/Shifra e aktivitetit \t{company['sifra_djelatnosti']}"
        # 1.5. Ime lica ovlašćenog za zastupanje (direktor)
        if direktor_ime and direktor_ime != "________________":
            repl["1.5.Ime lica ovlašćenog za zastupanje/Emri i personit të autorizuar për përfaqësim _____________________"] = \
                f"1.5.Ime lica ovlašćenog za zastupanje/Emri i personit të autorizuar për përfaqësim  {direktor_ime}"
        # 1.6. Žiro račun
        if company.get("ziro_racun"):
            repl["1.6.Žiro račun/i poslovna banka/Llogaria rrjedhëse dhe banka afariste ______________________________"] = \
                f"1.6.Žiro račun/i poslovna banka/Llogaria rrjedhëse dhe banka afariste  {company['ziro_racun']}"
        # 1.7. PIB
        if company_pib:
            repl["1.7. Poreski identifikacioni broj/Numri identifikues tatimor ______________________________________"] = \
                f"1.7. Poreski identifikacioni broj/Numri identifikues tatimor  {company_pib}"
        # 1.8. Telefon/email
        company_tel_val = company.get("telefon") or agency.get("telefon", "")
        if company_tel_val:
            repl["1.8.Telefon - i, fax - i, e-mail ______________________________________________________________"] = \
                f"1.8.Telefon - i, fax - i, e-mail  {company_tel_val}"
    
    # "Zahtjev za uzorkovanje i ispitivanje" (BRISEVA / HRANA / VODA ZA PIĆE) – novi šabloni sa eksplicitnim
    # placeholderima u zagradama (NAZIV_FIRME), (PIB_FIRME), (ADRESA_FIRME), itd.
    if "uzorkovanje" in tname_lower:
        company_tel_val2 = company.get("telefon") or agency.get("telefon", "")
        company_pdv_val = company.get("pdv_broj", "") or "____________"
        company_email_val = company.get("email") or agency.get("email", "") or "____________"
        company_sd_val = company.get("sifra_djelatnosti", "") or "____________"
        adresa_full = f"{company_adresa}, {company_grad}".strip(", ") if (company_adresa or company_grad) else "____________"
        naziv_objekta_val = company.get("naziv_skraceni") or company_naziv or "____________"
        
        # Glavni placeholder mappings (case-sensitive, zagrade)
        repl["(NAZIV_FIRME)"] = company_naziv or "____________"
        repl["NAZIV_FIRME"] = company_naziv or "____________"  # bez zagrada (HRANA P8)
        repl["(ADRESA_FIRME)"] = adresa_full
        repl["(ADRESA FIRME)"] = adresa_full  # sa space-om (HRANA)
        repl["(PIB_FIRME)"] = company_pib or "____________"
        repl["(PDV_BROJ)"] = company_pdv_val
        repl["(BROJ_TELEFONA)"] = company_tel_val2 or "____________"
        repl["(IME_PREZIME_DIREKTORA)"] = direktor_ime if direktor_ime != "________________" else "____________"
        repl["(ime_prezime_direktora)"] = direktor_ime if direktor_ime != "________________" else "____________"
        repl["(DATUM_STAMPE)"] = today_str
        repl["(NAZIV_OBJEKTA)"] = naziv_objekta_val
        repl["(SIFRA_DJELATNOSTI)"] = company_sd_val
        repl["(email_adresa_firme)"] = company_email_val
        repl["(EMAIL_ADRESA_FIRME)"] = company_email_val
        repl["(ULCINJ)"] = company_grad or "Ulcinj"  # mjesto podnošenja
        
        # Čišćenje leftover hardcoded podataka iz originalnih PDF-ova:
        repl["DOO FRIENDS CAFFE ULCINJ "] = ""
        repl["DOO FRIENDS CAFFE ULCINJ"] = ""
        # HRANA P2 - "Podaci o objektu" placeholder je izgubljen pri konverziji
        if company_naziv:
            repl["Podaci o objektu (navesti tačan naziv i adresu)________________________________________ _____________________________________________________________________________"] = \
                f"Podaci o objektu: {company_naziv}, {adresa_full}".rstrip(", ")
    
    return repl


def _fit_to_a4_one_page(doc: Document):
    """Postavlja A4 dimenzije, smanjuje margine i font da bi dokument stao u 1 stranicu.
    Koristi se za Obavještenje o knjizi prigovora (MSG 292).
    """
    from docx.shared import Cm, Pt
    # A4: 21.0 cm x 29.7 cm
    for section in doc.sections:
        section.page_width = Cm(21.0)
        section.page_height = Cm(29.7)
        section.top_margin = Cm(1.3)
        section.bottom_margin = Cm(1.3)
        section.left_margin = Cm(1.5)
        section.right_margin = Cm(1.5)
    
    # Smanji font veličinu za sve runove ako su veći od 11pt
    for para in doc.paragraphs:
        # Smanji prored
        try:
            para.paragraph_format.space_before = Pt(0)
            para.paragraph_format.space_after = Pt(2)
        except Exception:
            pass
        for run in para.runs:
            try:
                cur = run.font.size
                if cur is None or cur > Pt(11):
                    run.font.size = Pt(10)
            except Exception:
                pass
    
    for table in doc.tables:
        for row in table.rows:
            for cell in row.cells:
                for para in cell.paragraphs:
                    try:
                        para.paragraph_format.space_before = Pt(0)
                        para.paragraph_format.space_after = Pt(1)
                    except Exception:
                        pass
                    for run in para.runs:
                        try:
                            cur = run.font.size
                            if cur is None or cur > Pt(11):
                                run.font.size = Pt(10)
                        except Exception:
                            pass


def _docx_replace(doc: Document, replacements: Dict[str, str]):
    """Zamijenjuje sve placeholdere u dokumentu (paragrafima + tabelama)."""
    
    def replace_in_paragraph(paragraph):
        # Combine all runs text
        full_text = ''.join(run.text for run in paragraph.runs)
        new_text = full_text
        # Zamjene idu od najduže ka najkraćoj (da duži pattern ne bude pojeden kraćim)
        sorted_keys = sorted(replacements.keys(), key=len, reverse=True)
        for key in sorted_keys:
            val = replacements[key]
            if key and key in new_text:
                new_text = new_text.replace(key, val)
        
        if new_text != full_text and paragraph.runs:
            # Keep first run formatting, clear other runs
            paragraph.runs[0].text = new_text
            for run in paragraph.runs[1:]:
                run.text = ""
    
    for paragraph in doc.paragraphs:
        replace_in_paragraph(paragraph)
    
    for table in doc.tables:
        for row in table.rows:
            try:
                cells = list(row.cells)
            except Exception:
                # pdf2docx output može imati malformirane tc grid (vertical merge / missing tc).
                # Padaj na sirovo iteriranje raw <w:tc> elemenata.
                ns = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
                cells = []
                from docx.table import _Cell
                for tc in row._tr.findall(f'{ns}tc'):
                    try:
                        cells.append(_Cell(tc, table))
                    except Exception:
                        pass
            for cell in cells:
                for paragraph in cell.paragraphs:
                    replace_in_paragraph(paragraph)
    
    # Headers/footers
    for section in doc.sections:
        for header in [section.header, section.first_page_header, section.even_page_header]:
            if header:
                for paragraph in header.paragraphs:
                    replace_in_paragraph(paragraph)
        for footer in [section.footer, section.first_page_footer, section.even_page_footer]:
            if footer:
                for paragraph in footer.paragraphs:
                    replace_in_paragraph(paragraph)


import subprocess

def _convert_to_pdf(docx_path: Path) -> Optional[Path]:
    """Konvertuje docx u PDF koristeći LibreOffice headless. Vraća putanju do PDF-a ili None."""
    try:
        pdf_path = docx_path.with_suffix('.pdf')
        if pdf_path.exists():
            return pdf_path
        
        # Run LibreOffice headless conversion
        result = subprocess.run(
            [
                "soffice", "--headless", "--convert-to", "pdf",
                "--outdir", str(docx_path.parent),
                str(docx_path)
            ],
            capture_output=True, timeout=60
        )
        if result.returncode == 0 and pdf_path.exists():
            return pdf_path
        logging.warning(f"PDF conversion failed: {result.stderr.decode()[:200]}")
        return None
    except Exception as e:
        logging.error(f"PDF conversion error: {e}")
        return None


@api_router.post("/documents/generate")
async def generate_document(req: DocumentGenerateRequest, username: str = Depends(get_current_user)):
    template_path = TEMPLATES_DIR / req.template_filename
    if not template_path.exists():
        raise HTTPException(404, "Šablon nije pronađen")
    
    if template_path.suffix.lower() != '.docx':
        raise HTTPException(400, "Trenutno se podržava samo .docx generisanje")
    
    company = await db.companies.find_one({"id": req.company_id}, {"_id": 0})
    if not company:
        raise HTTPException(404, "Firma nije pronađena")
    
    employee = None
    if req.employee_id:
        employee = await db.employees.find_one({"id": req.employee_id}, {"_id": 0})
    
    agency = await db.agency.find_one({}, {"_id": 0}) or Agency().model_dump()
    
    replacements = _build_replacements(company, employee, agency, req.custom_fields, req.template_filename)
    
    # Load template, replace, save
    doc = Document(str(template_path))
    _docx_replace(doc, replacements)
    
    # MSG 292: Formatiranje na 1 A4 stranicu za Obavještenje o knjizi prigovora
    if "knjige prigovora" in req.template_filename.lower() or "knjigu prigovora" in req.template_filename.lower() or "podnosenja prigovora" in req.template_filename.lower():
        _fit_to_a4_one_page(doc)
    
    # Save generated file
    output_filename = f"{uuid.uuid4().hex[:8]}_{template_path.stem}_{company.get('naziv_skraceni') or company.get('naziv','firma')[:20]}.docx"
    output_filename = re.sub(r'[^\w\s.-]', '_', output_filename).replace(' ', '_')
    output_path = GENERATED_DIR / output_filename
    doc.save(str(output_path))
    
    # Convert to PDF in background (it takes 2-3s)
    pdf_filename = output_filename.replace('.docx', '.pdf')
    _convert_to_pdf(output_path)  # Generates the PDF beside .docx
    
    # Save record
    record = {
        "id": str(uuid.uuid4()),
        "filename": output_filename,
        "pdf_filename": pdf_filename,
        "template": req.template_filename,
        "company_id": req.company_id,
        "company_naziv": company.get("naziv", ""),
        "employee_id": req.employee_id,
        "employee_naziv": f"{employee.get('ime','')} {employee.get('prezime','')}".strip() if employee else "",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": username
    }
    await db.generated_documents.insert_one(dict(record))
    
    return {
        "success": True,
        "filename": output_filename,
        "pdf_filename": pdf_filename,
        "download_url": f"/api/documents/download/{output_filename}",
        "preview_url": f"/api/documents/preview/{pdf_filename}",
        "record": record
    }


@api_router.post("/documents/generate-aneks")
async def generate_aneks(req: AneksRequest, username: str = Depends(get_current_user)):
    """Generiše aneks ugovora i opciono ažurira polja zaposlenog u bazi."""
    employee = await db.employees.find_one({"id": req.employee_id}, {"_id": 0})
    if not employee:
        raise HTTPException(404, "Zaposleni nije pronađen")
    
    company = await db.companies.find_one({"id": employee.get("company_id")}, {"_id": 0})
    if not company:
        raise HTTPException(404, "Firma nije pronađena")
    
    agency = await db.agency.find_one({}, {"_id": 0}) or Agency().model_dump()
    
    # Konstruiši opis izmjena u Članu 2
    izmjene_lines = []
    
    # Trajanje radnog odnosa
    today = datetime.now(timezone.utc).date()
    if req.nova_vrsta_ugovora == "neodredjeno":
        izmjene_lines.append(
            f"Radni odnos se mijenja u radni odnos NA NEODREĐENO VRIJEME, počev od {today.strftime('%d.%m.%Y')} godine."
        )
    elif req.nova_vrsta_ugovora == "odredjeno":
        end_str = "____________"
        if req.novi_datum_kraja:
            try:
                end_dt = datetime.fromisoformat(req.novi_datum_kraja.replace('Z',''))
                end_str = end_dt.strftime('%d.%m.%Y')
            except Exception:
                end_str = req.novi_datum_kraja
        izmjene_lines.append(
            f"Radni odnos se produžava NA ODREĐENO VRIJEME, počev od {today.strftime('%d.%m.%Y')} do {end_str} godine."
        )
    
    # Iznos zarade
    if req.nova_plata_neto is not None and req.nova_plata_neto > 0:
        stara = float(employee.get("plata_neto") or 0)
        izmjene_lines.append(
            f"Iznos neto zarade se mijenja sa {stara:.2f} eura na {float(req.nova_plata_neto):.2f} eura mjesečno."
        )
    
    # Radno mjesto
    if req.nova_pozicija:
        stara_poz = employee.get("pozicija", "")
        if stara_poz != req.nova_pozicija:
            izmjene_lines.append(
                f"Radno mjesto se mijenja iz \"{stara_poz}\" u \"{req.nova_pozicija}\"."
            )
    
    if req.razlog:
        izmjene_lines.append(f"Razlog izmjene: {req.razlog}")
    
    if not izmjene_lines:
        izmjene_lines.append("(Nije navedena izmjena — molimo popunite Aneks ručno u Wordu.)")
    
    izmjene_text = "\n".join(f"{i+1}. {line}" for i, line in enumerate(izmjene_lines))
    
    # Brojač aneksa
    aneks_count = await db.generated_documents.count_documents(
        {"template": "ANEKS UGOVORA O RADU.docx", "employee_id": req.employee_id}
    )
    aneks_broj = f"{aneks_count + 1}/{today.year}"
    
    # Build replacements
    replacements = _build_replacements(company, employee, agency, {}, "ANEKS UGOVORA O RADU.docx")
    replacements["[ANEKS_IZMJENE]"] = izmjene_text
    replacements["{ANEKS_BROJ}"] = aneks_broj
    
    # Adresa firme full
    adresa_full = f"{company.get('adresa','')}, {company.get('grad','')}".strip(", ")
    replacements["[ADRESA_FIRME_FULL]"] = adresa_full or company.get('adresa','') or company.get('grad','')
    
    # Generate
    template_path = TEMPLATES_DIR / "ANEKS UGOVORA O RADU.docx"
    doc = Document(str(template_path))
    _docx_replace(doc, replacements)
    
    output_filename = f"{uuid.uuid4().hex[:8]}_ANEKS_{employee.get('ime','')}_{employee.get('prezime','')}.docx"
    output_filename = re.sub(r'[^\w.-]', '_', output_filename)
    output_path = GENERATED_DIR / output_filename
    doc.save(str(output_path))
    
    pdf_filename = output_filename.replace('.docx', '.pdf')
    _convert_to_pdf(output_path)
    
    # Ažuriraj zaposlenog ako je traženo
    if req.update_employee:
        update = {"vrsta_ugovora": req.nova_vrsta_ugovora}
        if req.novi_datum_kraja is not None:
            update["datum_kraja"] = req.novi_datum_kraja if req.nova_vrsta_ugovora == "odredjeno" else ""
        if req.nova_plata_neto is not None and req.nova_plata_neto > 0:
            update["plata_neto"] = float(req.nova_plata_neto)
        if req.nova_pozicija:
            update["pozicija"] = req.nova_pozicija
        await db.employees.update_one({"id": req.employee_id}, {"$set": update})
    
    # Save record
    record = {
        "id": str(uuid.uuid4()),
        "filename": output_filename,
        "pdf_filename": pdf_filename,
        "template": "ANEKS UGOVORA O RADU.docx",
        "company_id": company["id"],
        "company_naziv": company.get("naziv", ""),
        "employee_id": req.employee_id,
        "employee_naziv": f"{employee.get('ime','')} {employee.get('prezime','')}".strip(),
        "aneks_broj": aneks_broj,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": username,
    }
    await db.generated_documents.insert_one(dict(record))
    
    return {
        "success": True,
        "filename": output_filename,
        "pdf_filename": pdf_filename,
        "preview_url": f"/api/documents/preview/{pdf_filename}",
        "download_url": f"/api/documents/download/{output_filename}",
        "aneks_broj": aneks_broj,
        "record": record,
    }


@api_router.get("/documents/preview/{filename}")
async def preview_document(filename: str, token: Optional[str] = None):
    """Vraća PDF inline u browseru (za prikaz/štampu bez downloada).
    Podržava i generisane dokumente i izvorne PDF/DOCX šablone iz templates foldera.
    """
    if token:
        try:
            jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        except Exception:
            raise HTTPException(401, "Neispravan token")
    
    safe_name = os.path.basename(filename)
    
    # 1. Try GENERATED folder
    file_path = GENERATED_DIR / safe_name
    
    # 2. If PDF doesn't exist there, try to generate from sibling .docx (auto-create PDF)
    if not file_path.exists() and safe_name.endswith('.pdf'):
        docx_sibling = GENERATED_DIR / safe_name.replace('.pdf', '.docx')
        if docx_sibling.exists():
            _convert_to_pdf(docx_sibling)
    
    # 3. If still not found, try TEMPLATES folder (for source PDF/DOCX templates)
    if not file_path.exists():
        file_path = TEMPLATES_DIR / safe_name
        
        # If a .docx template, generate PDF copy in TEMPLATES folder (cached)
        if not file_path.exists() and safe_name.endswith('.pdf'):
            docx_in_templates = TEMPLATES_DIR / safe_name.replace('.pdf', '.docx')
            if docx_in_templates.exists():
                _convert_to_pdf(docx_in_templates)
                file_path = TEMPLATES_DIR / safe_name
    
    if not file_path.exists():
        raise HTTPException(404, "Dokument nije pronađen")
    
    return FileResponse(
        path=str(file_path),
        filename=safe_name,
        media_type='application/pdf',
        headers={"Content-Disposition": f'inline; filename="{safe_name}"'}
    )

@api_router.get("/documents/download/{filename}")
async def download_document(filename: str, token: Optional[str] = None):
    # Allow token via query param for download
    if token:
        try:
            jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        except Exception:
            raise HTTPException(401, "Neispravan token")
    
    safe_name = os.path.basename(filename)
    file_path = GENERATED_DIR / safe_name
    if not file_path.exists():
        # Try templates folder
        file_path = TEMPLATES_DIR / safe_name
        if not file_path.exists():
            raise HTTPException(404, "Fajl nije pronađen")
    
    return FileResponse(
        path=str(file_path),
        filename=safe_name,
        media_type='application/octet-stream'
    )

@api_router.get("/documents")
async def list_generated_documents(
    company_id: Optional[str] = None,
    username: str = Depends(get_current_user)
):
    query: Dict[str, Any] = {}
    if company_id:
        query["company_id"] = company_id
    docs = await db.generated_documents.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return docs


# ============== PDV / IOPPD TRACKING ==============

@api_router.get("/pdv-tracking")
async def get_pdv_tracking(year: int, month: int, username: str = Depends(get_current_user)):
    """Vraća listu svih PDV i IOPPD obveznika sa statusom predaje za dati mjesec."""
    companies = await db.companies.find(
        {"$or": [{"pdv_obveznik": True}, {"ioppd_obveznik": True}], "aktivna": True},
        {"_id": 0}
    ).sort("naziv", 1).to_list(1000)
    
    records = await db.pdv_records.find(
        {"year": year, "month": month}, {"_id": 0}
    ).to_list(1000)
    records_map = {r["company_id"]: r for r in records}
    
    result = []
    for c in companies:
        rec = records_map.get(c["id"], {})
        result.append({
            "company_id": c["id"],
            "company_naziv": c["naziv"],
            "pib": c["pib"],
            "pdv_obveznik": c.get("pdv_obveznik", False),
            "ioppd_obveznik": c.get("ioppd_obveznik", False),
            "pdv_predato": rec.get("pdv_predato", False),
            "pdv_datum": rec.get("pdv_datum", ""),
            "pdv_broj": rec.get("pdv_broj", ""),
            "ioppd_predato": rec.get("ioppd_predato", False),
            "ioppd_datum": rec.get("ioppd_datum", ""),
            "ioppd_broj": rec.get("ioppd_broj", ""),
        })
    return result

@api_router.put("/pdv-tracking/{company_id}")
async def update_pdv_tracking(
    company_id: str,
    year: int,
    month: int,
    data: PDVUpdate,
    username: str = Depends(get_current_user)
):
    existing = await db.pdv_records.find_one(
        {"company_id": company_id, "year": year, "month": month}, {"_id": 0}
    )
    
    update_dict = data.model_dump(exclude_none=True)
    
    # Auto-fill today's date when checking
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    if update_dict.get("pdv_predato") is True and not update_dict.get("pdv_datum"):
        if not existing or not existing.get("pdv_datum"):
            update_dict["pdv_datum"] = today
    if update_dict.get("ioppd_predato") is True and not update_dict.get("ioppd_datum"):
        if not existing or not existing.get("ioppd_datum"):
            update_dict["ioppd_datum"] = today
    
    if existing:
        await db.pdv_records.update_one(
            {"company_id": company_id, "year": year, "month": month},
            {"$set": update_dict}
        )
    else:
        record = PDVRecord(
            company_id=company_id, year=year, month=month, **update_dict
        ).model_dump()
        await db.pdv_records.insert_one(record)
    
    return {"success": True}


# ============== DASHBOARD STATS ==============

@api_router.get("/stats")
async def get_stats(username: str = Depends(get_current_user)):
    total_companies = await db.companies.count_documents({})
    active_companies = await db.companies.count_documents({"aktivna": True})
    pdv_count = await db.companies.count_documents({"pdv_obveznik": True, "aktivna": True})
    ioppd_count = await db.companies.count_documents({"ioppd_obveznik": True, "aktivna": True})
    total_employees = await db.employees.count_documents({})
    
    # Documents this month
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()
    docs_this_month = await db.generated_documents.count_documents({"created_at": {"$gte": month_start}})
    
    return {
        "total_companies": total_companies,
        "active_companies": active_companies,
        "pdv_count": pdv_count,
        "ioppd_count": ioppd_count,
        "total_employees": total_employees,
        "docs_this_month": docs_this_month,
    }


@api_router.get("/")
async def root():
    return {"app": "Getuard Agency", "version": "1.0.0"}


# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)
