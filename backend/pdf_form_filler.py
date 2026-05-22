"""
PDF Form Filler — koristi PyMuPDF (fitz) da popuni prazne PDF šablone podacima firme
upisujući tekst na tačno određene pozicije pored labela.

Originalni dizajn PDF-a se NE mijenja — samo se overlay-uje tekst na blank linije.
"""
import fitz  # PyMuPDF
from pathlib import Path
from datetime import datetime, timezone
from typing import Dict, Any, List, Tuple, Optional


def _draw_text(page: fitz.Page, text: str, x: float, y: float,
               fontsize: float = 10, max_width: float = 380,
               color: Tuple[float, float, float] = (0, 0, 0),
               fontname: str = "helv"):
    """Upiše tekst na PDF stranicu. Automatski wrap-uje ako prelazi max_width."""
    if not text:
        return
    text = str(text)
    # Truncate ako predugačko za jednu liniju (jednostavnije od wrap-a)
    if max_width:
        approx_chars = int(max_width / (fontsize * 0.5))
        if len(text) > approx_chars:
            # Probaj na 2 linije
            words = text.split()
            line1, line2 = "", ""
            for w in words:
                test = (line1 + " " + w).strip()
                if len(test) <= approx_chars:
                    line1 = test
                else:
                    line2 = (line2 + " " + w).strip()
            page.insert_text((x, y), line1, fontsize=fontsize, color=color, fontname=fontname)
            if line2:
                page.insert_text((x, y + fontsize + 2), line2, fontsize=fontsize, color=color, fontname=fontname)
            return
    page.insert_text((x, y), text, fontsize=fontsize, color=color, fontname=fontname)


def _find_label(page: fitz.Page, label_text: str) -> Optional[fitz.Rect]:
    """Vrati prvi rect labele ili None."""
    rects = page.search_for(label_text)
    return rects[0] if rects else None


def _fill_zahtjev_uzorkovanje(input_pdf: Path, output_pdf: Path, company: Dict[str, Any],
                              agency: Dict[str, Any] = None) -> bool:
    """Popuni Zahtjev za uzorkovanje (BRISEVA / HRANA / VODA / BAZENI)."""
    agency = agency or {}
    doc = fitz.open(str(input_pdf))
    page = doc[0]
    
    naziv = company.get("naziv", "")
    naziv_skraceni = company.get("naziv_skraceni") or naziv
    adresa = company.get("adresa", "")
    grad = company.get("grad", "")
    pib = company.get("pib", "")
    pdv = company.get("pdv_broj", "")
    tel = company.get("telefon", "") or agency.get("telefon", "")
    
    adresa_full = f"{adresa}, {grad}" if adresa and grad else (adresa or grad or "")
    
    # 1) "Podaci o objektu": ispod ili pored
    lbl = _find_label(page, "Podaci o objektu")
    if lbl:
        # Upiši ime objekta + adresu na liniji iznad/pored — koordinata x desno od labele
        _draw_text(page, f"{naziv_skraceni}, {adresa_full}".rstrip(", "),
                   lbl.x1 + 8, lbl.y1 - 1, fontsize=9, max_width=420)
    
    # 2) "Naziv (institucija, firma, pravno/fizičko lice i sl.)" — ispod te labele
    lbl = _find_label(page, "Naziv (institucija")
    if lbl:
        _draw_text(page, naziv, lbl.x0 - 153, lbl.y1 + 16, fontsize=9, max_width=440)
    
    # 3) "Adresa:" — desno od labele
    lbl = _find_label(page, "Adresa:")
    if lbl:
        _draw_text(page, adresa_full, lbl.x1 + 4, lbl.y1 - 1, fontsize=9, max_width=420)
    
    # 4) "PIB:" — desno od labele
    lbl = _find_label(page, "PIB:")
    if lbl:
        _draw_text(page, pib, lbl.x1 + 4, lbl.y1 - 1, fontsize=9, max_width=200)
    
    # 5) "PDV:" — desno od labele
    lbl = _find_label(page, "PDV:")
    if lbl:
        _draw_text(page, pdv or "", lbl.x1 + 4, lbl.y1 - 1, fontsize=9, max_width=200)
    
    # 6) "Kontakt tel/FAX:" (BRISEVA/VODA) ili "Kontakt tel:" (HRANA)
    for tel_label in ["Kontakt tel/FAX:", "Kontakt tel:"]:
        lbl = _find_label(page, tel_label)
        if lbl:
            _draw_text(page, tel, lbl.x1 + 4, lbl.y1 - 1, fontsize=9, max_width=400)
            break
    
    doc.save(str(output_pdf))
    doc.close()
    return True


def _fill_prijava_zanatstva(input_pdf: Path, output_pdf: Path, company: Dict[str, Any],
                            agency: Dict[str, Any] = None,
                            extras: Dict[str, Any] = None) -> bool:
    """Popuni Prijava zanatstva sa podacima firme + dodatnim input poljima."""
    agency = agency or {}
    extras = extras or {}
    doc = fitz.open(str(input_pdf))
    page1 = doc[0]
    page2 = doc[1] if doc.page_count > 1 else page1
    
    naziv = company.get("naziv", "")
    adresa = company.get("adresa", "")
    grad = company.get("grad", "")
    pib = company.get("pib", "")
    tel = company.get("telefon", "") or agency.get("telefon", "")
    sifra_dj = company.get("sifra_djelatnosti", "")
    ziro = company.get("ziro_racun", "")
    direktor = company.get("direktor_ime", "")
    maticni = company.get("maticni_broj", "")
    
    # ============ PAGE 1 ============
    # 0) Header — Br./Nr.: 08-___  → broj iz custom-a ako ima
    today = datetime.now(timezone.utc).strftime("%d.%m.%Y")
    
    # 1) Označavanje: "početak obavljanja zanatstva" ili "promjena podataka"
    tip = (extras.get("tip_prijave") or "pocetak").lower()
    pocetak_lbl = _find_label(page1, "početak obavljanja")
    if pocetak_lbl and tip == "pocetak":
        _draw_text(page1, "X", pocetak_lbl.x0 - 15, pocetak_lbl.y1 - 2, fontsize=11, color=(0, 0, 0))
    promjena_lbl = _find_label(page1, "promjena podataka")
    if promjena_lbl and tip == "promjena":
        _draw_text(page1, "X", promjena_lbl.x0 - 15, promjena_lbl.y1 - 2, fontsize=11, color=(0, 0, 0))
    
    # 2) "1.1. Naziv/ime/Emri"
    lbl = _find_label(page1, "1.1. Naziv/ime/Emri")
    if lbl:
        _draw_text(page1, naziv, lbl.x1 + 4, lbl.y1 - 1, fontsize=9, max_width=420)
    
    # 3) "a. Sjedište/Selia ___ adresa ___"
    lbl = _find_label(page1, "a. Sjedište/Selia")
    if lbl:
        _draw_text(page1, grad, lbl.x1 + 4, lbl.y1 - 1, fontsize=9, max_width=120)
    lbl_adr = _find_label(page1, "adresa")
    if lbl_adr:
        _draw_text(page1, adresa, lbl_adr.x1 + 4, lbl_adr.y1 - 1, fontsize=9, max_width=300)
    
    # 4) "b. Broj i datum rješenja o upisu u Centralni Registar Privrednog Suda"
    lbl = _find_label(page1, "Broj i datum rješenja")
    if lbl:
        # Već postoji "5 - 1180946 / 002 2023-10-02" u ovom šablonu, ostavi prazno za korisnika
        if maticni:
            _draw_text(page1, maticni, lbl.x1 + 4, lbl.y1 - 1, fontsize=9, max_width=250)
    
    # 5) "1.4. Šifra djelatnosti"
    lbl = _find_label(page1, "1.4. Šifra djelatnosti")
    if lbl:
        _draw_text(page1, sifra_dj, lbl.x1 + 150, lbl.y1 - 1, fontsize=9, max_width=140)
    
    # 6) "1.5.Ime lica ovlašćenog za zastupanje"
    lbl = _find_label(page1, "1.5.Ime lica ovlašćenog")
    if lbl:
        _draw_text(page1, direktor, lbl.x1 + 4, lbl.y1 - 1, fontsize=9, max_width=300)
    
    # 7) "1.6.Žiro račun"
    lbl = _find_label(page1, "1.6.Žiro račun")
    if lbl:
        _draw_text(page1, ziro, lbl.x1 + 220, lbl.y1 - 1, fontsize=9, max_width=140)
    
    # 8) "1.7. Poreski identifikacioni broj"
    lbl = _find_label(page1, "1.7. Poreski identifikacioni broj")
    if lbl:
        _draw_text(page1, pib, lbl.x1 + 4, lbl.y1 - 1, fontsize=9, max_width=200)
    
    # 9) "1.8.Telefon"
    lbl = _find_label(page1, "1.8.Telefon")
    if lbl:
        _draw_text(page1, tel, lbl.x1 + 4, lbl.y1 - 1, fontsize=9, max_width=300)
    
    # 10) Header dat. + "Ulcinj/Ulqin," — auto današnji datum
    lbl = _find_label(page1, "Ulcinj/Ulqin,")
    if lbl:
        _draw_text(page1, today, lbl.x1 + 4, lbl.y1 - 1, fontsize=9, max_width=120)
    
    # ============ PAGE 2 ============
    if doc.page_count > 1:
        page2 = doc[1]
        
        # 2.1 Vrsta zanata (slobodan input od user-a)
        vrsta_zanata = extras.get("vrsta_zanata", "")
        if vrsta_zanata:
            # Pronađi liniju "- zanatska djelatnost/aktiviteti zejtar"
            lbl = _find_label(page2, "zanatska djelatnost")
            if lbl:
                _draw_text(page2, vrsta_zanata, lbl.x1 + 4, lbl.y1 - 1, fontsize=9, max_width=300)
        
        # 3.1 "Sjedište/Selia ___ adresa: ___" (user input ili default firma podaci)
        sjediste_zanatstva = extras.get("sjediste_zanatstva") or grad
        adresa_zanatstva = extras.get("adresa_zanatstva") or adresa
        lbl = _find_label(page2, "3.1. Sjedište/Selia")
        if lbl:
            _draw_text(page2, sjediste_zanatstva, lbl.x1 + 4, lbl.y1 - 1, fontsize=9, max_width=160)
        lbl_adr = _find_label(page2, "adresa:")
        if lbl_adr:
            _draw_text(page2, adresa_zanatstva, lbl_adr.x1 + 4, lbl_adr.y1 - 1, fontsize=9, max_width=320)
        
        # 3.2 "Površina/Sipërfaqja" — m² (user input)
        m2_poslovni = extras.get("m2_poslovni") or extras.get("m2", "")
        m2_stambeni = extras.get("m2_stambeni", "")
        lbl = _find_label(page2, "poslovni prostor")
        if lbl and m2_poslovni:
            _draw_text(page2, f"{m2_poslovni}", lbl.x1 + 130, lbl.y1 - 1, fontsize=9, max_width=60)
        lbl = _find_label(page2, "stambeni prostor")
        if lbl and m2_stambeni:
            _draw_text(page2, f"{m2_stambeni}", lbl.x1 + 130, lbl.y1 - 1, fontsize=9, max_width=60)
        
        # 5. Datum početka rada — od user input ili današnji
        datum_pocetka = extras.get("datum_pocetka_rada", today)
        lbl = _find_label(page2, "5. Datum početka rada")
        if lbl:
            _draw_text(page2, datum_pocetka, lbl.x1 + 130, lbl.y1 - 1, fontsize=9, max_width=180)
    
    doc.save(str(output_pdf))
    doc.close()
    return True


def _fill_prijava_trgovine(input_pdf: Path, output_pdf: Path, company: Dict[str, Any],
                            agency: Dict[str, Any] = None,
                            extras: Dict[str, Any] = None) -> bool:
    """Popuni Prijava trgovine — overlay text + X mark-ove na original PDF."""
    agency = agency or {}
    extras = extras or {}
    doc = fitz.open(str(input_pdf))
    page1 = doc[0]
    
    naziv = company.get("naziv", "")
    adresa = company.get("adresa", "")
    grad = company.get("grad", "")
    pib = company.get("pib", "")
    tel = company.get("telefon", "") or agency.get("telefon", "")
    email = company.get("email", "") or agency.get("email", "")
    sifra_dj = company.get("sifra_djelatnosti", "")
    ziro = company.get("ziro_racun", "")
    direktor = company.get("direktor_ime", "")
    direktor_jmbg = company.get("direktor_jmbg", "")
    maticni = company.get("maticni_broj", "")
    crps_datum = company.get("crps_datum", "") or company.get("datum_registracije", "")
    
    today = datetime.now(timezone.utc).strftime("%d.%m.%Y")
    
    # 1) Tip prijave: X kraj odgovarajuće linije
    tip = (extras.get("tip_prijave") or "pocetak").lower()
    pocetak_lbl = _find_label(page1, "početak obavljanja trgovine")
    if pocetak_lbl and tip == "pocetak":
        _draw_text(page1, "X", pocetak_lbl.x0 - 15, pocetak_lbl.y1 - 2, fontsize=11)
    promjena_lbl = _find_label(page1, "promjena  podataka iz prijave")
    if promjena_lbl and tip == "promjena":
        _draw_text(page1, "X", promjena_lbl.x0 - 15, promjena_lbl.y1 - 2, fontsize=11)
    
    # 2) 1.1. Naziv/ime
    lbl = _find_label(page1, "1.1. Naziv /ime")
    if lbl:
        _draw_text(page1, naziv, lbl.x1 + 8, lbl.y1 - 1, fontsize=9, max_width=380)
    
    # 3) 1.2. Sjedište + adresa  (prva "adresa" je u sekciji 1.2)
    lbl = _find_label(page1, "1.2. Sjedište")
    if lbl:
        _draw_text(page1, grad, lbl.x1 + 8, lbl.y1 - 1, fontsize=9, max_width=140)
    adr_rects = page1.search_for("adresa")
    if adr_rects:
        a = adr_rects[0]
        _draw_text(page1, adresa, a.x1 + 8, a.y1 - 1, fontsize=9, max_width=200)
    
    # 4) 1.3. Broj i datum rješenja
    lbl = _find_label(page1, "1.3. Broj i datum rješenja")
    if lbl:
        line = f"{maticni}  {crps_datum}".strip() if maticni or crps_datum else ""
        if line:
            _draw_text(page1, line, lbl.x0 + 5, lbl.y1 + 14, fontsize=9, max_width=350)
    
    # 5) 1.4. Šifra djelatnosti  
    lbl = _find_label(page1, "1.4. Šifra dijelatnosti")
    if lbl:
        _draw_text(page1, sifra_dj, lbl.x1 + 8, lbl.y1 - 1, fontsize=9, max_width=200)
    
    # 6) 1.5. Ime lica ovlašćenog
    lbl = _find_label(page1, "1.5. Ime lica ovlašćenog")
    if lbl:
        line = f"{direktor} {direktor_jmbg}".strip() if direktor_jmbg else direktor
        _draw_text(page1, line, lbl.x1 + 8, lbl.y1 - 1, fontsize=9, max_width=300)
    
    # 7) 1.6. Žiro račun
    lbl = _find_label(page1, "1.6. Žiro")
    if lbl:
        _draw_text(page1, ziro, lbl.x1 + 8, lbl.y1 - 1, fontsize=9, max_width=300)
    
    # 8) 1.7. PIB
    lbl = _find_label(page1, "1.7. Poreski identifikacijoni")
    if lbl:
        _draw_text(page1, pib, lbl.x1 + 8, lbl.y1 - 1, fontsize=9, max_width=300)
    
    # 9) Telefon, fax, e-mail
    lbl = _find_label(page1, "1.6. Telefon, fax, e-mail")
    if lbl:
        line = ", ".join(x for x in [tel, email] if x)
        _draw_text(page1, line, lbl.x1 + 8, lbl.y1 - 1, fontsize=9, max_width=300)
    
    # 10) Vrsta trgovine — checkbox (X lijevo od labele)
    vrsta_trg = (extras.get("vrsta_trgovine") or "").lower()
    map_vrsta = {
        "veliko": "trgovina na veliko",
        "malo": "trgovina na malo",
        "distanciona": "Distanciona",
        "usluge": "trgovinske usluge",
    }
    for k, label in map_vrsta.items():
        if k in vrsta_trg:
            lbl = _find_label(page1, label)
            if lbl:
                _draw_text(page1, "X", lbl.x0 - 15, lbl.y1 - 2, fontsize=11)
    
    # 11) Vrsta robe / trgovinske usluge — text (ispod kolone "Vrsta robe")
    if extras.get("vrsta_robe"):
        lbl = _find_label(page1, "Vrsta robe")
        if lbl:
            _draw_text(page1, extras["vrsta_robe"], lbl.x0, lbl.y1 + 18, fontsize=9, max_width=200)
    
    # 12) 3.1 Sjedište + adresa prostorije
    sjediste_obj = extras.get("sjediste_objekta") or grad
    naziv_obj = extras.get("naziv_objekta", "")
    adresa_obj = extras.get("adresa_objekta") or adresa
    if naziv_obj:
        adresa_obj = f"{naziv_obj} – {adresa_obj}" if adresa_obj else naziv_obj
    lbl = _find_label(page1, "3.1.Sjedište")
    if lbl:
        _draw_text(page1, sjediste_obj, lbl.x1 + 8, lbl.y1 - 1, fontsize=9, max_width=160)
    adr_rects = page1.search_for("adresa:")
    if adr_rects:
        a = adr_rects[-1]  # poslednji "adresa:" je za 3.1
        _draw_text(page1, adresa_obj, a.x1 + 8, a.y1 - 1, fontsize=9, max_width=200)
    
    # ============ PAGE 2 ============
    if doc.page_count > 1:
        page2 = doc[1]
        
        # 3.2 Vrsta prostorije + m² checkbox-ovi (X lijevo, m² na desnoj koloni ~x=490)
        prostor_data = [
            ("m2_prodavnica", "-prodavnica"),
            ("m2_skladiste", "-skladište"),
            ("m2_stovariste", "-stovarište"),
            ("m2_drugo", "-drugo prodajno mesto"),
            ("m2_usluge_prostor", "prostorija za obavljanje trgovinskih usluga"),
            ("m2_pijaca", "pijaca i dr.prostori"),
        ]
        for key, label_text in prostor_data:
            m2_val = extras.get(key)
            if m2_val:
                lbl = _find_label(page2, label_text)
                if lbl:
                    _draw_text(page2, "X", lbl.x0 - 15, lbl.y1 - 2, fontsize=11)
                    # Upiši m² vrijednost na desnoj koloni (m² je oko x=524)
                    _draw_text(page2, str(m2_val), 490, lbl.y1 - 1, fontsize=9, max_width=30)
        
        # Lokacija — u zatvorenom / na otvorenom / na pijaci
        lokacija = (extras.get("lokacija") or "").lower()
        loc_map = {
            "zatvor": "u zatvorenom prostoru",
            "otvoren": "na otvorenom prostoru",
            "pijac": "na pijaci",
        }
        for k, label in loc_map.items():
            if k in lokacija:
                lbl = _find_label(page2, label)
                if lbl:
                    _draw_text(page2, "X", lbl.x0 - 15, lbl.y1 - 2, fontsize=11)
        
        # 5. Datum početka rada
        datum_pocetka = extras.get("datum_pocetka_rada", "")
        lbl = _find_label(page2, "5.Datum početka")
        if lbl and datum_pocetka:
            _draw_text(page2, datum_pocetka, lbl.x1 + 8, lbl.y1 - 1, fontsize=9, max_width=200)
        
        # 6. Vrsta i opis promjene
        if tip == "promjena" and extras.get("opis_promjene"):
            lbl = _find_label(page2, "6.Vrsta i opis promjene")
            if lbl:
                _draw_text(page2, extras["opis_promjene"], lbl.x1 + 8, lbl.y1 - 1, fontsize=9, max_width=300)
        
        # 7. Datum nastanka promjene
        if tip == "promjena" and extras.get("datum_promjene"):
            lbl = _find_label(page2, "7.Datum nastanka")
            if lbl:
                _draw_text(page2, extras["datum_promjene"], lbl.x1 + 8, lbl.y1 - 1, fontsize=9, max_width=200)
        
        # 8. Datum podnošenja prijave — user input ili današnji
        datum_podnosenja = extras.get("datum_podnosenja") or today
        lbl = _find_label(page2, "8.Datum podnošenja")
        if lbl:
            _draw_text(page2, datum_podnosenja, lbl.x1 + 8, lbl.y1 - 1, fontsize=9, max_width=200)
        
        # Potpis: ime i prezime direktora
        lbl = _find_label(page2, "ime i prezime i potpis")
        if lbl and direktor:
            _draw_text(page2, direktor, lbl.x0, lbl.y0 - 12, fontsize=9, max_width=200)
    
    doc.save(str(output_pdf))
    doc.close()
    return True


def fill_pdf_template(template_filename: str, output_pdf: Path,
                      company: Dict[str, Any],
                      agency: Dict[str, Any] = None,
                      extras: Dict[str, Any] = None) -> bool:
    """Glavni entry point — pozove tačnu funkciju za zadati šablon."""
    forms_dir = Path("/app/backend/templates_pdf_forms")
    src = forms_dir / template_filename
    if not src.exists():
        return False
    
    tn = template_filename.lower()
    if "uzorkovanje" in tn:
        return _fill_zahtjev_uzorkovanje(src, output_pdf, company, agency)
    elif "prijava zanatstva" in tn or "prijava_zanatstva" in tn:
        return _fill_prijava_zanatstva(src, output_pdf, company, agency, extras)
    elif "prijava trgovine" in tn or "prijava_trgovine" in tn:
        return _fill_prijava_trgovine(src, output_pdf, company, agency, extras)
    return False


# Lista šablona koje koriste PDF-overlay umjesto DOCX
PDF_FORM_TEMPLATES = [
    "Zahtjev za uzorkovanje i ispitivanje - BRISEVA.pdf",
    "Zahtjev za uzorkovanje i ispitivanje - HRANA.pdf",
    "Zahtjev za uzorkovanje i ispitivanje - VODA ZA PICE.pdf",
    "Zahtjev za uzorkovanje i ispitivanje - BAZENI.pdf",
    "Prijava zanatstva.pdf",
    "Prijava trgovine.pdf",
]


def is_pdf_form_template(template_filename: str) -> bool:
    return template_filename in PDF_FORM_TEMPLATES
