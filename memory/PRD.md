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
- **22.05.2026 (iter 3)**: Phase 3a — Native PDF overlay engine (`pdf_form_filler.py`) za Zahtjeve (HRANA/VODA/BAZENI/BRISEVI) + Prijava zanatstva.
- **22.05.2026 (iter 4)**: **Prijava trgovine PDF-overlay** — registracija u dispatcher, custom modal UI prema mockup-u sa sekcijama 1/2/3/5-8, vrsta trgovine radios, m² grid sa checkbox-ima (prodavnica/skladište/stovarište/drugo/usluge/pijaca), lokacija radio (zatvor/otvoren/pijaca), DD/MM/YYYY 3-field datum, opis+datum promjene conditional, unifikovani dizajn sa Prijava zanatstva. Frontend modal sada otvara i .pdf form templates (ne samo .docx). PDF-only result UI bez Word dugmeta. Backend `is_pdf_form` flag dodat u `/api/templates`. 43/43 testova prolaze.
- **22.05.2026 (iter 5)**: **PDF overlay refinements** — fix preklapanja teksta sa labelama (1.3 ispod "Subjekata"/"Gjykatës ekonomike", 1.5 nakon "i JMB"/"për përfaqësim", 1.6 Žiro nakon full bilingual label, 1.7 PIB nakon "tatimor", 1.8 Telefon nakon "e-mail"); zone-scoped "adresa" search da izbjegne preklapanje sa headerom; font enlarged 9→11pt; **Liberation Sans TTF font** za Unicode dijakritike (š,č,ć,ž,đ) — riješeno "TAMIŠ" → "TAMI·" problem. Frontend: search dropdown sada **prikazuje samo rezultate po unesenom terminu** (ne cijelu listu); empty state placeholder. 43/43 testova prolaze.
- **22.05.2026 (iter 6)**: **Apsolutne koordinate iz ručno popunjenih reference PDF-ova** — `_fill_prijava_trgovine` i `_fill_prijava_zanatstva` koriste apsolutne (x,y) tačno iz user-ovih ELA ART i MARINI GROUP popunjenih PDF-ova. Sve labele se sada poklapaju.
- **22.05.2026 (iter 7)**: **Dinamičke X pozicije** — X za vrstu trgovine, lokaciju i vrstu prostorije se dinamički postavlja na `lbl.x1 + 22` da nikad ne preklapa labelu bez obzira na dužinu (npr. "-drugo prodajno mesto" vs "-prodavnica"). Vrsta robe tekst je u DESNOJ koloni na ISTOM y kao izabrana vrsta trgovine (raniji bug: tekst je išao na drugi red).
- **22.05.2026 (iter 8)**: **Istorija prijava + UX fixes**
  - **Istorija prijava modul**: Novi tab "Istorija prijava" u /dokumenti — tabela sa svim generisanim dokumentima (datum, firma, prijava, tip Početak/Promjena, akcije: štampaj/preuzmi/Promjena/obriši). Klik na "Promjena" otvara modal pre-popunjen sa prošlim custom_fields + tip="promjena" — direktno se može napraviti izmjena prijave bez ponovnog unosa svih podataka. Filter po firmi za pregled svih prijava jedne firme.
  - **Backend**: `GET/DELETE /api/documents/history`, `GET /api/documents/history/{id}`. `custom_fields` se sada perzistiraju u `generated_documents` kolekciju za sve PDF/DOCX generacije.
  - **Auto-shortening naziva**: Ako firma ima `naziv_skraceni` koristi se taj. Ako naziv > 60 chars i nema skraćenog, ekstraktuje se naziv između navodnika ("EURO PIZZA") + sufiks (DOO/AD) → "DOO EURO PIZZA". Spriječava prelivanje kroz formu.
  - **Klikabilan company picker**: Dropdown <select> zamijenjen klikabilnim karticama sa hover state-om. User može odmah kliknuti firmu (raniji bug: select sa size= nije omogućavao klik na već-selektovanu).
  - **X za "početak"/"promjena"** trgovine: pomjereno na lbl.x1+12, mali font 12pt — tačno na crtici ___.
  - **X za "promjena"** zanatstva: pomjereno desno na kraj bilingual "fletëparaqitja 2)" labele.
  - 43/43 testova prolaze.
- **30.05.2026 (Finansije modul)**: **Kompletan finansijski modul** za praćenje prihoda i rashoda agencije.
  - **Backend**: `/api/finance/pricing` (cjenovnik po firmi), `/api/finance/payments` (mjesečne uplate sa auto-merge svih firmi za izabrani mjesec), `/api/finance/services` (dodatne usluge CRUD), `/api/finance/expenses` (troškovi CRUD), `/api/finance/summary` (profit kalkulacija sa mjesečnim breakdown-om), `/api/finance/overdue` (alarmi za neplaćene > X dana), `/api/finance/export/excel` (4-sheet xlsx: uplate, usluge, troškovi, sažetak), `/api/finance/export/pdf` (reportlab PDF sa sažetkom i mjesečnim pregledom).
  - **Frontend** (`Finansije.jsx`): 5 tabova — **Mjesečne naknade** (lista svih firmi za izabrani mjesec sa quick-edit iznosa/checkbox/datum/napomena, cjenovnik panel, visual red overdue indicator), **Alarmi** (lista firmi sa neplaćenim mjesecima, ukupno dugovanje, klikabilni mjesec-chip-ovi za quick mark-paid, podesiv grace period 0/15/30/60/90 dana, badge counter na tabu), **Dodatne usluge** (CRUD modal sa firmom + datum + iznos + paid status), **Troškovi** (CRUD modal sa kategorijama opšti/usluga, povezivanje sa extra service), **Pregled profita** (4 stat kartice + 2 profit breakdown kartice + 12-mjesečna tabela + Excel/PDF export dugmad).
  - **DB kolekcije**: `company_pricing`, `monthly_payments`, `extra_services`, `expenses`.
  - **Sidebar**: Dodat "Finansije" link sa € ikonom kao top-level. Route `/finansije`.
  - Backend testiran kroz curl (CRUD, exports valid xlsx+pdf, overdue logika ispravna).
