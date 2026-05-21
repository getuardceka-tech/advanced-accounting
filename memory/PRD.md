# Getuard Agency - Product Requirements Document

## Original Problem Statement (Bosanski/Srpski/Crnogorski)
Korisnik Getuard Cekoviq iz Ulcinja, Crna Gora, vlasnik računovodstvene agencije sa preko 50 firmi klijenata, želi softver za:
1. Bazu podataka svih firmi klijenata sa automatskim popunjavanjem podataka preko IRMS portala Poreske uprave CG (PIB lookup)
2. Bazu zaposlenika po firmama
3. Generator dokumenata iz 57 Word/PDF šablona (ugovori, odluke, obavještenja, zahtjevi, prijave, ovlaštenja)
4. Praćenje PDV/IOPPD obveznika sa mjesečnim listama i čekiranjem predaja
5. Praćenje finansijskih iskaza

**Postavke:** Latinica, Crna Gora, EUR, Master login: getuard / Getuard1994.

## User Personas
- **Vlasnik agencije (Getuard Cekoviq)** - jedini korisnik, master pristup, vodi sve klijente

## Core Requirements (Static)
1. Sigurna autentifikacija sa JWT tokenom
2. CRUD za firme, zaposlenike
3. Generator dokumenata iz .docx šablona sa auto-popunjavanjem
4. IRMS lookup po PIB-u (graceful fallback ako portal nije dostupan)
5. PDV/IOPPD checklist mjesečno
6. Profesionalan dashboard sa statistikom

## Architecture
- **Frontend:** React 19 + React Router 7 + Phosphor Icons + custom CSS (Cabinet Grotesk + IBM Plex Sans)
- **Backend:** FastAPI + Motor (MongoDB) + python-docx + JWT + bcrypt
- **Database:** MongoDB (collections: users, agency, companies, employees, generated_documents, pdv_records)

## What's Been Implemented (Phase 1 MVP - May 2026)

### Backend (100% tested - 24/24 tests passing)
- ✅ JWT auth sa bcrypt hash-om (default user: getuard / Getuard1994.)
- ✅ Agency settings (singleton, seedan na startup-u)
- ✅ Companies CRUD sa pretragom, PDV/IOPPD filterima, validacijom duplikata PIB-a
- ✅ IRMS PIB lookup (pokušava 3 API endpointa, gracefully fallback ako nije dostupan)
- ✅ Employees CRUD vezan za firme
- ✅ Templates listing (57 šablona iz `/app/backend/templates/`)
- ✅ Document generation (.docx) - kopira šablon, zamjenjuje placeholdere ([NAZIV_FIRME], [PIB_FIRME], [IME_RADNIKA], itd.), snima u `/app/backend/generated/`
- ✅ Download sa JWT token validacijom
- ✅ PDV/IOPPD tracking po (company, year, month)
- ✅ Dashboard stats endpoint

### Frontend
- ✅ Login stranica (split layout sa branding-om)
- ✅ Sidebar layout (Cabinet Grotesk + IBM Plex Sans, Slate/Obsidian paleta)
- ✅ Dashboard sa stat cards, posljednjim firmama/dokumentima, brzim prečacima
- ✅ Firme: lista sa pretragom/filterima, modal za dodavanje/uređivanje sa IRMS lookup dugmetom
- ✅ Detalj firme: tabovi (Podaci / Zaposleni / Dokumenti), CRUD zaposlenih
- ✅ Generator dokumenata: kategorisana mreža, modal sa firma+zaposleni selektorom
- ✅ PDV/IOPPD: mjesečna tabela sa čekiranjem, datumima, brojevima predaja, štampanjem
- ✅ Agency settings
- ✅ Responsive, profesionalan dizajn (no purple gradients, no AI slop)
- ✅ Sve elemente ima data-testid

## Prioritized Backlog (Phase 2+)

### P0 (Visoki prioritet - sljedeća iteracija)
- 🔐 **Vault**: lozinke, tokeni, ovlaštenja sa enkripcijom + podsjetnici za isteke
- 💰 **Finansije agencije**: cjenovnik po firmi, mjesečno praćenje plaćanja, troškovi, godišnji izvještaji
- 📊 **Finansijski iskazi**: godišnja evidencija po firmi
- 🔔 **Podsjetnici**: rokovi za PDV (10. u mjesecu), IOPPD (15.), finansijski iskazi (28.02.)

### P1
- 🎯 IRMS scraping (Playwright/Selenium) ako API ne radi
- 📧 Email integracija (slanje dokumenata klijentu, podsjetnici za neplaćene)
- 📈 Grafovi (Recharts): mjesečni prihodi, top klijenti, status plaćanja
- 🧾 Auto-generisanje faktura
- 📤 Export svega u Excel/PDF/CSV
- 📅 Kalendar obaveza (godišnji odmori, rokovi prijava)

### P2
- 👥 Više korisnika sa ulogama (admin, knjigovođa)
- 🌐 Klijentski portal (svaki klijent vidi svoja plaćanja, dokumente)
- 💳 Online plaćanje (Stripe integracija)
- 📱 PWA / mobile app
- 🤖 AI asistent za pretragu i predikciju
- 📊 Smart predviđanja, anomalije u plaćanju

## Tehnička poboljšanja (sugestije iz test agenta)
- IRMS lookup prebaciti sa blocking `requests` na async `httpx`
- DELETE endpointi vraćati 404 za nepostojeće ID
- PUT /companies dodati duplicate-PIB check
- HTTPBearer(auto_error=False) za 401 umjesto 403

## Test Credentials
- Username: `getuard`
- Password: `Getuard1994.`
- URL: https://dobar-dan.preview.emergentagent.com

## Files Structure
```
/app/backend/
  server.py             # Sav backend (auth, companies, employees, docs, PDV, stats)
  templates/            # 57 Word/PDF šablona (Getuard ih je upload-ovao)
  generated/            # Generisani dokumenti
  tests/backend_test.py # 24 pytest testa (24/24 prolaze)

/app/frontend/src/
  App.js, App.css, index.css
  lib/api.js            # axios + token helpers
  components/
    Login.jsx
    Layout.jsx          # sidebar + topbar
    Dashboard.jsx
    Companies.jsx       # lista + modal za dodavanje
    CompanyDetail.jsx   # tabovi: podaci/zaposleni/dokumenti
    Documents.jsx       # generator
    PdvTracking.jsx
    AgencySettings.jsx
```

## Date Log
- **21.05.2026**: Faza 1 MVP završena. Backend 24/24 testova prošlo. Frontend ručno testiran (login, dashboard, firme, modal sa IRMS, dokumenti, PDV). Sve glavne funkcije rade.
