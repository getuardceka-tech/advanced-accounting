# Advanced Accounting Agency - Product Requirements Document

## Original Problem Statement (Bosanski/Srpski/Crnogorski)
Korisnik Getuard Cekoviq iz Ulcinja, Crna Gora, vlasnik računovodstvene agencije sa preko 50 firmi klijenata, želi softver za:
1. Bazu podataka svih firmi klijenata sa automatskim popunjavanjem podataka preko IRMS portala Poreske uprave CG (PIB lookup)
2. Bazu zaposlenika po firmama
3. Generator dokumenata iz 58 Word/PDF šablona (ugovori, odluke, obavještenja, zahtjevi, prijave, ovlaštenja)
4. Praćenje PDV/IOPPD obveznika sa mjesečnim listama i čekiranjem predaja
5. Praćenje finansijskih iskaza
6. Podsjetnike za isteke ugovora o radu (30 dana)

**Postavke:** Latinica, Crna Gora, EUR, Master login: getuard / Getuard1994.

## Architecture
- **Frontend:** React 19 + React Router 7 + Phosphor Icons + custom CSS (Cabinet Grotesk + IBM Plex Sans)
- **Backend:** FastAPI + Motor (MongoDB) + python-docx + pdf2docx + LibreOffice headless + JWT + bcrypt
- **Database:** MongoDB (collections: users, agency, companies, employees, generated_documents, pdv_records)

## What's Been Implemented

### Phase 1 MVP (May 2026)
- ✅ JWT auth sa bcrypt hash-om
- ✅ Agency settings (singleton)
- ✅ Companies CRUD sa pretragom, PDV/IOPPD filterima, validacijom duplikata PIB-a
- ✅ IRMS PIB lookup
- ✅ Employees CRUD vezan za firme
- ✅ Templates listing (58 šablona)
- ✅ Document generation (.docx) - kopira šablon, zamjenjuje placeholdere, snima
- ✅ Download/Preview (PDF konverzija preko LibreOffice headless)
- ✅ PDV/IOPPD tracking
- ✅ Dashboard stats endpoint
- ✅ Frontend: Login, Sidebar, Dashboard, Firme, Detalj firme, Documents, PDV/IOPPD, Settings
- ✅ Contract Expiration Reminders widget (30 dana)
- ✅ Aneks ugovora UI sa modalom

### Phase 2 - MSG 292 Template Mappings (Maj 2026, iter. 2)
- ✅ Konverzija 7 od 9 PDF šablona u DOCX preko pdf2docx (preserve layout)
- ✅ 2 image-only PDF-a ostavljena kao PDF za štampanje praznog formulara: OP OBRAZAC.pdf, ZAHTJEV ZA ODOBRENJE ZA DUVAN.pdf
- ✅ Specifična mapiranja za sve dokumente iz Msg 292:
  - Prijava zanatstva (label-anchored: Naziv, Sjedište, PIB, Žiro, Telefon, Šifra djelatnosti)
  - Izjava o pravima i obavezama zaposlenog (Ime+JMBG+Radno mjesto+Datum stupanja)
  - Pojedinačno obavještenje o mobingu (employee data)
  - Odluka o podizanju novca (žiro račun + datum štampe)
  - Odluka za popust u prodavnicu (datum štampe)
  - Odluka o blagajničkom maksimumu (datum štampe)
  - Rješenje o prestanku radnog odnosa (koristi `datum_kraja`/`datum_prestanka`)
  - Obrazloženje za poresku upravu za kašnjenje odjave (datum_kraja)
  - Rješenje o korišćenju godišnjeg odmora (BLANK datum)
  - Zahtjev iz kaznene evidencije fizičko lice (employee data prioritet ako je dat)
- ✅ Formatiranje "Obavještenje o knjizi prigovora" na 1 A4 stranicu (A4 dimenzije + male margine + 10pt font)
- ✅ `_docx_replace` otporno na malformirane tabele (pdf2docx output)
- ✅ Testovi: 43/43 prolaze (24 iter1 + 19 iter2)

## Prioritized Backlog (Phase 3+)

### P0
- 🔐 **Vault**: lozinke, tokeni, ovlaštenja za pristup portalima sa enkripcijom + podsjetnici
- 💰 **Finansije agencije**: cjenovnik po firmi, mjesečno praćenje plaćanja, troškovi, godišnji izvještaji

### P1
- 📊 **PDV/IOPPD enhancements**: rokovi (10. PDV, 15. IOPPD), godišnji finansijski iskazi (28.02.)
- 🌐 **CRPS lookup**: dugme pored PIB-a za otvaranje IRMS/CRPS portala
- 🎯 IRMS scraping (Playwright/Selenium) ako API ne radi
- 📧 Email integracija (slanje dokumenata klijentu)
- 📈 Grafovi (Recharts): mjesečni prihodi, top klijenti
- 🧾 Auto-generisanje faktura

### P2
- 📅 Kalendar obaveza
- 👥 Više korisnika sa ulogama
- 🌐 Klijentski portal
- 💳 Online plaćanje (Stripe)
- 📱 PWA / mobile app

## Tehnička dugovanja
- `server.py` 1844 linija — treba split na `routers/` + `services/`
- `_convert_to_pdf` blokira request (LibreOffice ~2-3s) — pretvoriti u background task
- 2 PDF-a (OP OBRAZAC, DUVAN) su image-based skenirani — ne mogu se auto-popuniti (limitation)

## Test Credentials
- Username: `getuard`
- Password: `Getuard1994.`

## Files Structure
```
/app/backend/
  server.py             # Sav backend
  templates/            # 58 šablona (56 docx + 2 pdf)
  templates_pdf_originals/  # Originalni PDF-ovi (backup)
  generated/            # Generisani dokumenti
  tests/
    backend_test.py     # 24 iter1 testova
    test_document_generation.py # 19 iter2 testova

/app/frontend/src/
  components/
    Login.jsx, Layout.jsx, Dashboard.jsx, Companies.jsx,
    CompanyDetail.jsx, Persons.jsx, Documents.jsx,
    PdvTracking.jsx, AgencySettings.jsx
```

## Date Log
- **21.05.2026**: Faza 1 MVP završena. 24/24 backend testova.
- **21.05.2026 (iter 2)**: Phase 2 — MSG 292 mapiranja + PDF→DOCX konverzija + A4 formatiranje. 43/43 testova prolaze.
