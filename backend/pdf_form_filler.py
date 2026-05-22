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
    """Upiše tekst na PDF stranicu. Automatski wrap-uje ako prelazi max_width.
    Koristi Liberation Sans TTF za Unicode podršku (š, č, ć, ž, đ).
    """
    if not text:
        return
    text = str(text)
    # Embeddovan Unicode font preko fontfile (DejaVu/Liberation podržava sve dijakritike)
    ttf_path = "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"
    kwargs = {"fontsize": fontsize, "color": color}
    try:
        kwargs["fontfile"] = ttf_path
        kwargs["fontname"] = "LibSans"
    except Exception:
        kwargs["fontname"] = fontname
    
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
            page.insert_text((x, y), line1, **kwargs)
            if line2:
                page.insert_text((x, y + fontsize + 2), line2, **kwargs)
            return
    page.insert_text((x, y), text, **kwargs)


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
    FONT = 11
    
    # 1) "Podaci o objektu": ispod ili pored
    lbl = _find_label(page, "Podaci o objektu")
    if lbl:
        _draw_text(page, f"{naziv_skraceni}, {adresa_full}".rstrip(", "),
                   lbl.x1 + 8, lbl.y1 - 1, fontsize=FONT, max_width=420)
    
    # 2) "Naziv (institucija, firma, pravno/fizičko lice i sl.)" — ispod te labele
    lbl = _find_label(page, "Naziv (institucija")
    if lbl:
        _draw_text(page, naziv, lbl.x0 - 153, lbl.y1 + 16, fontsize=FONT, max_width=440)
    
    # 3) "Adresa:" — desno od labele
    lbl = _find_label(page, "Adresa:")
    if lbl:
        _draw_text(page, adresa_full, lbl.x1 + 4, lbl.y1 - 1, fontsize=FONT, max_width=420)
    
    # 4) "PIB:" — desno od labele
    lbl = _find_label(page, "PIB:")
    if lbl:
        _draw_text(page, pib, lbl.x1 + 4, lbl.y1 - 1, fontsize=FONT, max_width=200)
    
    # 5) "PDV:" — desno od labele
    lbl = _find_label(page, "PDV:")
    if lbl:
        _draw_text(page, pdv or "", lbl.x1 + 4, lbl.y1 - 1, fontsize=FONT, max_width=200)
    
    # 6) "Kontakt tel/FAX:" (BRISEVA/VODA) ili "Kontakt tel:" (HRANA)
    for tel_label in ["Kontakt tel/FAX:", "Kontakt tel:"]:
        lbl = _find_label(page, tel_label)
        if lbl:
            _draw_text(page, tel, lbl.x1 + 4, lbl.y1 - 1, fontsize=FONT, max_width=400)
            break
    
    doc.save(str(output_pdf))
    doc.close()
    return True


def _fill_prijava_zanatstva(input_pdf: Path, output_pdf: Path, company: Dict[str, Any],
                            agency: Dict[str, Any] = None,
                            extras: Dict[str, Any] = None) -> bool:
    """Popuni Prijava zanatstva — apsolutne koordinate prema referentnom popunjenom PDF-u."""
    agency = agency or {}
    extras = extras or {}
    doc = fitz.open(str(input_pdf))
    page1 = doc[0]
    
    naziv = company.get("naziv", "")
    adresa = company.get("adresa", "")
    grad = company.get("grad", "") or "Ulcinj"
    pib = company.get("pib", "")
    tel = company.get("telefon", "") or agency.get("telefon", "")
    sifra_dj = company.get("sifra_djelatnosti", "")
    ziro = company.get("ziro_racun", "")
    direktor = company.get("direktor_ime", "")
    direktor_lk = company.get("direktor_jmbg", "") or company.get("direktor_lk", "")
    maticni = company.get("maticni_broj", "")
    crps_datum = company.get("crps_datum", "") or company.get("datum_registracije", "")
    
    today = datetime.now(timezone.utc).strftime("%d.%m.%Y")
    FONT = 11
    
    # ============ PAGE 1 ============
    
    # Header datum: ostavljamo prazno — user obično popunjava ručno
    # (Br./Nr.: 08- ___ i Ulcinj/Ulqin, ___ ostaju prazni)
    
    # Tip prijave: X
    tip = (extras.get("tip_prijave") or "pocetak").lower()
    if tip == "pocetak":
        _draw_text(page1, "X", 484, 313, fontsize=13, max_width=20)
    else:
        _draw_text(page1, "X", 484, 327, fontsize=13, max_width=20)
    
    # 1.1. Naziv/ime
    _draw_text(page1, naziv, 171, 369, fontsize=FONT, max_width=340)
    
    # a. Sjedište + adresa
    _draw_text(page1, grad, 197, 410, fontsize=FONT, max_width=160)
    _draw_text(page1, adresa, 368, 410, fontsize=FONT, max_width=180)
    
    # b. Broj i datum rješenja (na liniji ispod albanskog dijela labele)
    if maticni or crps_datum:
        line = f"{maticni}  {crps_datum}".strip()
        _draw_text(page1, line, 250, 466, fontsize=FONT, max_width=320)
    
    # 1.4. Šifra djelatnosti
    _draw_text(page1, sifra_dj, 332, 493, fontsize=FONT, max_width=160)
    
    # 1.5. Ime lica ovlašćenog
    _draw_text(page1, direktor, 476, 521, fontsize=FONT, max_width=150)
    # broj lične karte ispod
    if direktor_lk:
        _draw_text(page1, direktor_lk, 340, 535, fontsize=FONT, max_width=200)
    
    # 1.6. Žiro račun
    _draw_text(page1, ziro, 430, 557, fontsize=FONT, max_width=180)
    
    # 1.7. PIB
    _draw_text(page1, pib, 364, 584, fontsize=FONT, max_width=200)
    
    # 1.8. Telefon
    _draw_text(page1, tel, 224, 615, fontsize=FONT, max_width=340)
    
    # 2. Vrsta zanata — na liniji "- zanatska djelatnost/aktiviteti zejtar"
    vrsta_zanata = extras.get("vrsta_zanata", "")
    if vrsta_zanata:
        _draw_text(page1, vrsta_zanata, 332, 699, fontsize=FONT, max_width=280)
    
    # ============ PAGE 2 ============
    if doc.page_count > 1:
        page2 = doc[1]
        
        # 3.1 Sjedište + adresa prostorije
        sjediste_zanatstva = extras.get("sjediste_zanatstva") or grad
        adresa_zanatstva = extras.get("adresa_zanatstva") or adresa
        _draw_text(page2, sjediste_zanatstva, 128, 74, fontsize=FONT, max_width=160)
        _draw_text(page2, adresa_zanatstva, 326, 74, fontsize=FONT, max_width=200)
        
        # 3.2 Površina — m² po izboru
        m2_poslovni = extras.get("m2_poslovni") or extras.get("m2", "")
        m2_stambeni = extras.get("m2_stambeni", "")
        if m2_poslovni:
            _draw_text(page2, "X", 238, 116, fontsize=13, max_width=20)
            _draw_text(page2, str(m2_poslovni), 452, 116, fontsize=FONT, max_width=50)
        if m2_stambeni:
            _draw_text(page2, "X", 238, 131, fontsize=13, max_width=20)
            _draw_text(page2, str(m2_stambeni), 452, 131, fontsize=FONT, max_width=50)
        
        # 5. Datum početka rada
        datum_pocetka = extras.get("datum_pocetka_rada", "")
        if datum_pocetka:
            _draw_text(page2, datum_pocetka, 424, 254, fontsize=FONT, max_width=140)
        
        # 6. Opis promjene
        if tip == "promjena" and extras.get("opis_promjene"):
            _draw_text(page2, extras["opis_promjene"], 400, 281, fontsize=FONT, max_width=180)
        
        # 7. Datum nastanka promjene
        if tip == "promjena" and extras.get("datum_promjene"):
            _draw_text(page2, extras["datum_promjene"], 400, 345, fontsize=FONT, max_width=140)
        
        # 8. Datum podnošenja
        datum_podnosenja = extras.get("datum_podnosenja") or today
        _draw_text(page2, datum_podnosenja, 433, 375, fontsize=FONT, max_width=140)
        
        # Potpis (ime i prezime)
        if direktor:
            _draw_text(page2, direktor, 290, 401, fontsize=FONT, max_width=200)
    
    doc.save(str(output_pdf))
    doc.close()
    return True


def _fill_prijava_trgovine(input_pdf: Path, output_pdf: Path, company: Dict[str, Any],
                            agency: Dict[str, Any] = None,
                            extras: Dict[str, Any] = None) -> bool:
    """Popuni Prijava trgovine — apsolutne koordinate prema referentnom popunjenom PDF-u."""
    agency = agency or {}
    extras = extras or {}
    doc = fitz.open(str(input_pdf))
    page1 = doc[0]
    
    naziv = company.get("naziv", "")
    adresa = company.get("adresa", "")
    grad = company.get("grad", "") or "Ulcinj"
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
    FONT = 11
    
    # ============ PAGE 1 ============
    
    # Tip prijave: X (pozicija nakon "trgovine 1)" / "iz prijave2)")
    tip = (extras.get("tip_prijave") or "pocetak").lower()
    if tip == "pocetak":
        _draw_text(page1, "X", 482, 156, fontsize=13, max_width=20)
    else:
        _draw_text(page1, "X", 482, 171, fontsize=13, max_width=20)
    
    # 1.1. Naziv (wraps to 2 lines if long)
    _draw_text(page1, naziv, 182, 220, fontsize=FONT, max_width=380)
    
    # 1.2. Sjedište + adresa
    _draw_text(page1, grad, 183, 268, fontsize=FONT, max_width=130)
    _draw_text(page1, adresa, 362, 268, fontsize=FONT, max_width=180)
    
    # 1.3. Broj i datum rješenja — pišemo na desnoj koloni, ispod "Subjekata" reda
    if maticni:
        _draw_text(page1, maticni, 452, 320, fontsize=FONT, max_width=130)
    if crps_datum:
        _draw_text(page1, crps_datum, 452, 336, fontsize=FONT, max_width=130)
    
    # 1.4. Šifra djelatnosti (desno)
    _draw_text(page1, sifra_dj, 452, 362, fontsize=FONT, max_width=110)
    
    # 1.5. Ime ovlašćenog + JMB
    _draw_text(page1, direktor, 326, 383, fontsize=FONT, max_width=230)
    if direktor_jmbg:
        _draw_text(page1, f"JMB: {direktor_jmbg}", 326, 405, fontsize=FONT, max_width=230)
    
    # 1.6. Žiro
    _draw_text(page1, ziro, 326, 427, fontsize=FONT, max_width=230)
    
    # 1.7. PIB
    _draw_text(page1, pib, 326, 448, fontsize=FONT, max_width=230)
    
    # 1.6. Telefon + e-mail
    tel_line = ", ".join(x for x in [tel, email] if x)
    _draw_text(page1, tel_line, 326, 470, fontsize=FONT, max_width=230)
    
    # Vrsta trgovine — X uz odgovarajuću liniju
    vrsta_trg = (extras.get("vrsta_trgovine") or "").lower()
    vrsta_x_pos = {
        "veliko": ("X", 244, 554),     # -trgovina na veliko
        "malo": ("X", 244, 597),       # -trgovina na malo
        "distanciona": ("X", 244, 641), # Distanciona
        "usluge": ("X", 244, 684),     # -trgovinske usluge
    }
    for k, (sym, x, y) in vrsta_x_pos.items():
        if k in vrsta_trg:
            _draw_text(page1, sym, x, y, fontsize=13, max_width=20)
    
    # Vrsta robe / trgovinske usluge (desna kolona)
    if extras.get("vrsta_robe"):
        _draw_text(page1, extras["vrsta_robe"], 304, 597, fontsize=FONT, max_width=200)
    
    # 3.1 Sjedište prostorije + adresa objekta + naziv
    sjediste_obj = extras.get("sjediste_objekta") or grad
    naziv_obj = extras.get("naziv_objekta", "")
    adresa_obj = extras.get("adresa_objekta") or adresa
    if naziv_obj:
        adresa_obj = f"{naziv_obj} – {adresa_obj}" if adresa_obj else naziv_obj
    _draw_text(page1, sjediste_obj, 183, 727, fontsize=FONT, max_width=130)
    _draw_text(page1, adresa_obj, 362, 727, fontsize=FONT, max_width=200)
    
    # ============ PAGE 2 ============
    if doc.page_count > 1:
        page2 = doc[1]
        
        # Y pozicije iz reference PDF-a (m² label baseline + 11pt):
        prostor_y = {
            "m2_prodavnica":     50,
            "m2_skladiste":      71,
            "m2_stovariste":     93,
            "m2_drugo":          114,
            "m2_usluge_prostor": 199,
            "m2_pijaca":         262,
        }
        for key, y_pos in prostor_y.items():
            m2_val = extras.get(key)
            if m2_val:
                _draw_text(page2, "X", 188, y_pos, fontsize=13, max_width=20)
                _draw_text(page2, str(m2_val), 479, y_pos, fontsize=FONT, max_width=40)
        
        # Lokacija (u zatvorenom / na otvorenom / na pijaci)
        lokacija = (extras.get("lokacija") or "").lower()
        loc_y = {"zatvor": 135, "otvoren": 156, "pijac": 177}
        for k, y in loc_y.items():
            if k in lokacija:
                _draw_text(page2, "X", 158, y, fontsize=13, max_width=20)
        
        # 5. Datum početka rada
        datum_pocetka = extras.get("datum_pocetka_rada", "")
        if datum_pocetka:
            _draw_text(page2, datum_pocetka, 320, 379, fontsize=FONT, max_width=200)
        
        # 6. Vrsta i opis promjene
        if tip == "promjena" and extras.get("opis_promjene"):
            _draw_text(page2, extras["opis_promjene"], 255, 408, fontsize=FONT, max_width=300)
        
        # 7. Datum nastanka promjene
        if tip == "promjena" and extras.get("datum_promjene"):
            _draw_text(page2, extras["datum_promjene"], 320, 436, fontsize=FONT, max_width=200)
        
        # 8. Datum podnošenja
        datum_podnosenja = extras.get("datum_podnosenja") or today
        _draw_text(page2, datum_podnosenja, 320, 464, fontsize=FONT, max_width=200)
        
        # Potpis (ime i prezime)
        if direktor:
            _draw_text(page2, direktor, 290, 492, fontsize=FONT, max_width=200)
    
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
