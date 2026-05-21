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
    Pokušaj automatskog dohvata podataka firme iz IRMS Crne Gore.
    https://irms.tax.gov.me/public/search-register/business-entities
    """
    pib = pib.strip()
    if not pib or not pib.isdigit():
        raise HTTPException(400, "PIB mora biti broj")
    
    result = {
        "success": False,
        "source": "IRMS",
        "pib": pib,
        "data": {},
        "message": ""
    }
    
    # Try common IRMS API patterns
    api_endpoints = [
        {
            "url": "https://irms.tax.gov.me/api/public/business-entities/search",
            "method": "POST",
            "json": {"pibOrRegistrationNumber": pib}
        },
        {
            "url": "https://irms.tax.gov.me/api/public/search-register/business-entities",
            "method": "POST",
            "json": {"pib": pib, "registrationNumber": pib}
        },
        {
            "url": f"https://irms.tax.gov.me/api/public/business-entities?pib={pib}",
            "method": "GET",
            "json": None
        },
    ]
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9,sr;q=0.8",
        "Origin": "https://irms.tax.gov.me",
        "Referer": "https://irms.tax.gov.me/public/search-register/business-entities",
    }
    
    for endpoint in api_endpoints:
        try:
            if endpoint["method"] == "POST":
                resp = requests.post(endpoint["url"], json=endpoint["json"], headers=headers, timeout=8)
            else:
                resp = requests.get(endpoint["url"], headers=headers, timeout=8)
            
            if resp.status_code == 200:
                try:
                    data = resp.json()
                    # Parse data - try common field names
                    parsed = _parse_irms_response(data, pib)
                    if parsed:
                        result["success"] = True
                        result["data"] = parsed
                        result["message"] = "Podaci uspješno preuzeti sa IRMS portala"
                        return result
                except Exception:
                    pass
        except Exception as e:
            logging.warning(f"IRMS endpoint failed: {endpoint['url']}: {e}")
            continue
    
    result["message"] = (
        "IRMS portal trenutno nije dostupan za automatsko popunjavanje. "
        "Molimo unesite podatke ručno ili koristite link za CRPS pretragu."
    )
    result["crps_link"] = f"https://irms.tax.gov.me/public/search-register/business-entities"
    return result


def _parse_irms_response(data: Any, pib: str) -> Optional[Dict[str, str]]:
    """Pokušaj izvući podatke firme iz IRMS odgovora."""
    if not data:
        return None
    
    # Try to find first match
    items = []
    if isinstance(data, list):
        items = data
    elif isinstance(data, dict):
        for key in ['data', 'items', 'results', 'content', 'businessEntities']:
            if key in data and isinstance(data[key], list):
                items = data[key]
                break
        if not items and data:
            items = [data]
    
    if not items:
        return None
    
    item = items[0]
    if not isinstance(item, dict):
        return None
    
    # Map fields
    def find_field(*keys):
        for key in keys:
            for k, v in item.items():
                if key.lower() in k.lower() and v:
                    return str(v)
        return ""
    
    return {
        "naziv": find_field("name", "naziv", "businessName", "companyName"),
        "pib": find_field("pib", "taxNumber"),
        "maticni_broj": find_field("registrationNumber", "maticni", "registration"),
        "adresa": find_field("address", "adresa", "street"),
        "grad": find_field("city", "grad", "municipality"),
        "djelatnost": find_field("activity", "djelatnost", "businessActivity"),
        "sifra_djelatnosti": find_field("activityCode", "sifra"),
        "direktor_ime": find_field("director", "representative", "directorName"),
    }


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
    "DOO CULT ULCINJ",
    "CULT ULCINJ",
    # MARINI GROUP
    'DRUŠTVO SA OGRANIČENOM ODGOVORNOŠĆU "MARINI GROUP" ULCINJ',
    "MARINI GROUP",
    # SUMA FRESH MARKET
    'DRUŠTVO SA OGRANIČENOM ODGOVORNOŠĆU "SUMA FRESH MARKET" - ULCINJ',
    'DRUŠTVO SA OGRANIČENOM ODGOVORNOŠĆU  "SUMA FRESH MARKET" ULCINJ',
    'DRUŠTVO SA OGRANIČENOM ODGOVORNOŠĆU "SUMA FRESH MARKET" ULCINJ',
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
]

# Sample PIBs koje treba zamijeniti (sa izabranom firmom)
SAMPLE_PIBS = ["03801969", "03796841", "03807851", "03663108", "1906972223002"]

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
    "VELLEZERIT FRASHERI BB",
    "VELIKA PLAZA BB - ULCINJ",
    "VLADIMIR BB",
    "VLADIMIR   bb",
    "VLADIMIR BB ULCINJ",
]

# Sample matični/registracijski brojevi
SAMPLE_REG_NUMBERS = ["5-1354657/001"]

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
]
SAMPLE_EMPLOYEE_JMBGS = ["1411008223029", "039066621", "3004974220012"]
SAMPLE_EMPLOYEE_POSITIONS = [
    "KONOBAR",
    "KUVAR",
    "pomoćni radnik u gradjevinu",
    "pomocni radnik u gradjevinu",
    "NK – nekvalifikovani radnik",
    "NK - nekvalifikovani radnik",
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


def _build_replacements(company: dict, employee: Optional[dict], agency: dict, custom: dict) -> Dict[str, str]:
    """Gradi dictionary svih mogućih placeholdera za zamjenu."""
    today = datetime.now(timezone.utc)
    
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
    
    # Sample director JMBGs → real
    for sample_jmbg in SAMPLE_DIRECTOR_JMBGS:
        if direktor_jmbg and direktor_jmbg != "________________":
            repl[sample_jmbg] = direktor_jmbg
    
    # Sample addresses → real
    for sample_addr in SAMPLE_COMPANY_ADDRESSES:
        if company_adresa:
            repl[sample_addr] = full_adresa
    
    # Sample reg numbers
    for sample_reg in SAMPLE_REG_NUMBERS:
        if company.get("maticni_broj"):
            repl[sample_reg] = company["maticni_broj"]
    
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
    
    # Brisanje specifičnih datuma/periode/dana - klijent ručno popuni
    for sample_period, blank in SAMPLE_PERIODS_TO_BLANK.items():
        repl[sample_period] = blank
    
    # Header datumi u dokumentima ("Ulcinj, 01.01.2026 god.") → grad firme + današnji datum
    header_city = company_grad or "Ulcinj"
    today_str = today.strftime("%d.%m.%Y")
    repl["Ulcinj, 01.01.2026 god."] = f"{header_city}, {today_str} god."
    repl["Ulcinj, 02.02.2026 god."] = f"{header_city}, {today_str} god."
    repl["Ulcinj, 02.02.2026"] = f"{header_city}, {today_str}"
    
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
    
    return repl


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
            for cell in row.cells:
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
    
    replacements = _build_replacements(company, employee, agency, req.custom_fields)
    
    # Load template, replace, save
    doc = Document(str(template_path))
    _docx_replace(doc, replacements)
    
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


@api_router.get("/documents/preview/{filename}")
async def preview_document(filename: str, token: Optional[str] = None):
    """Vraća PDF inline u browseru (za prikaz/štampu bez downloada)."""
    if token:
        try:
            jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        except Exception:
            raise HTTPException(401, "Neispravan token")
    
    safe_name = os.path.basename(filename)
    file_path = GENERATED_DIR / safe_name
    
    # If PDF doesn't exist, try to generate it on the fly from sibling .docx
    if not file_path.exists() and safe_name.endswith('.pdf'):
        docx_sibling = GENERATED_DIR / safe_name.replace('.pdf', '.docx')
        if docx_sibling.exists():
            _convert_to_pdf(docx_sibling)
    
    if not file_path.exists():
        raise HTTPException(404, "PDF nije pronađen")
    
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
