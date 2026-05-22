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
    
    # Helper: pronađi labelu u određenoj y-oblasti (case-insensitive search)
    def find_in_zone(page, text, y_min=0, y_max=10000):
        rects = page.search_for(text)
        for r in rects:
            if y_min <= r.y0 <= y_max:
                return r
        return None
    
    FONT = 11
    
    # ============ PAGE 1 ============
    today = datetime.now(timezone.utc).strftime("%d.%m.%Y")
    
    # 1) Označavanje: "početak obavljanja zanatstva" ili "promjena podataka"
    tip = (extras.get("tip_prijave") or "pocetak").lower()
    pocetak_lbl = _find_label(page1, "početak obavljanja")
    if pocetak_lbl and tip == "pocetak":
        _draw_text(page1, "X", pocetak_lbl.x0 - 15, pocetak_lbl.y1 - 2, fontsize=12, color=(0, 0, 0))
    promjena_lbl = _find_label(page1, "promjena podataka")
    if promjena_lbl and tip == "promjena":
        _draw_text(page1, "X", promjena_lbl.x0 - 15, promjena_lbl.y1 - 2, fontsize=12, color=(0, 0, 0))
    
    # 2) "1.1. Naziv/ime/Emri"
    lbl = _find_label(page1, "1.1. Naziv/ime/Emri")
    if lbl:
        _draw_text(page1, naziv, lbl.x1 + 8, lbl.y1 - 1, fontsize=FONT, max_width=380)
    
    # 3) "a. Sjedište/Selia ___ adresa ___" — koristi 2. label da odredi y zonu
    lbl = _find_label(page1, "Sjedište/Selia")
    if lbl:
        # Find any "Selia" in same row (more reliable end position)
        selia_rects = page1.search_for("Selia")
        selia_in_row = next((r for r in selia_rects if abs(r.y0 - lbl.y0) < 5), None)
        x_grad = (selia_in_row.x1 if selia_in_row else lbl.x1) + 8
        _draw_text(page1, grad, x_grad, lbl.y1 - 1, fontsize=FONT, max_width=140)
        # adresa: scope to same y row (sa marginom ±10)
        adr = find_in_zone(page1, "adresa", lbl.y0 - 5, lbl.y0 + 20)
        if adr:
            _draw_text(page1, adresa, adr.x1 + 8, adr.y1 - 1, fontsize=FONT, max_width=240)
    
    # 4) "Broj i datum rješenja" — labela ima 2 reda (do "Gjykatës ekonomike"), upisuje se ispod
    lbl = _find_label(page1, "Broj i datum rješenja")
    if lbl and maticni:
        # Find "Gjykatës ekonomike" (kraj 2. reda labele) i piši ispod
        gjk = _find_label(page1, "Gjykatës ekonomike")
        y_pos = (gjk.y1 + 14) if gjk else (lbl.y1 + 28)
        _draw_text(page1, maticni, lbl.x0, y_pos, fontsize=FONT, max_width=350)
    
    # 5) "1.4. Šifra djelatnosti" — full label ide do 251, write iza
    lbl = _find_label(page1, "1.4. Šifra djelatnosti/Shifra e aktivitetit")
    if not lbl:
        lbl = _find_label(page1, "1.4. Šifra djelatnosti")
    if lbl:
        _draw_text(page1, sifra_dj, lbl.x1 + 8, lbl.y1 - 1, fontsize=FONT, max_width=200)
    
    # 6) "1.5.Ime lica ovlašćenog za zastupanje" — full label ends at "për përfaqësim"
    lbl = _find_label(page1, "1.5.Ime lica ovlašćenog")
    if lbl:
        ext = _find_label(page1, "për përfaqësim")
        x_start = (ext.x1 if ext else lbl.x1 + 200) + 8
        _draw_text(page1, direktor, x_start, lbl.y1 - 1, fontsize=FONT, max_width=200)
    
    # 7) "1.6.Žiro račun" — full label long
    lbl = _find_label(page1, "1.6.Žiro račun/i poslovna banka/Llogaria")
    if not lbl:
        lbl = _find_label(page1, "1.6.Žiro račun")
    if lbl:
        # Find end of full label "rrjedhëse dhe banka afariste" or similar
        ext = _find_label(page1, "banka afariste")
        x_start = (ext.x1 if ext else lbl.x1) + 8
        _draw_text(page1, ziro, x_start, lbl.y1 - 1, fontsize=FONT, max_width=200)
    
    # 8) "1.7. Poreski identifikacioni broj" — extends through Albanian
    lbl = _find_label(page1, "1.7. Poreski identifikacioni broj/Numri")
    if not lbl:
        lbl = _find_label(page1, "1.7. Poreski identifikacioni")
    if lbl:
        ext = _find_label(page1, "identifikues tatimor")
        x_start = (ext.x1 if ext else lbl.x1) + 8
        _draw_text(page1, pib, x_start, lbl.y1 - 1, fontsize=FONT, max_width=200)
    
    # 9) "1.8.Telefon" — full bilingual extension
    lbl = _find_label(page1, "1.8.Telefon")
    if lbl:
        ext = _find_label(page1, "e-mail")
        # Use the e-mail rect on same row as "1.8.Telefon"
        if ext and abs(ext.y0 - lbl.y0) < 5:
            x_start = ext.x1 + 8
        else:
            x_start = lbl.x1 + 150
        _draw_text(page1, tel, x_start, lbl.y1 - 1, fontsize=FONT, max_width=280)
    
    # 10) Header dat. + "Ulcinj/Ulqin,"
    lbl = _find_label(page1, "Ulcinj/Ulqin,")
    if lbl:
        _draw_text(page1, today, lbl.x1 + 4, lbl.y1 - 1, fontsize=FONT, max_width=120)
    
    # ============ PAGE 2 ============
    if doc.page_count > 1:
        page2 = doc[1]
        
        vrsta_zanata = extras.get("vrsta_zanata", "")
        if vrsta_zanata:
            lbl = _find_label(page2, "zanatska djelatnost")
            if lbl:
                _draw_text(page2, vrsta_zanata, lbl.x1 + 8, lbl.y1 - 1, fontsize=FONT, max_width=300)
        
        # 3.1
        sjediste_zanatstva = extras.get("sjediste_zanatstva") or grad
        adresa_zanatstva = extras.get("adresa_zanatstva") or adresa
        lbl = _find_label(page2, "3.1. Sjedište/Selia")
        if lbl:
            _draw_text(page2, sjediste_zanatstva, lbl.x1 + 8, lbl.y1 - 1, fontsize=FONT, max_width=140)
            # adresa: scoped to same row
            adr = find_in_zone(page2, "adresa:", lbl.y0 - 5, lbl.y0 + 20)
            if adr:
                _draw_text(page2, adresa_zanatstva, adr.x1 + 8, adr.y1 - 1, fontsize=FONT, max_width=240)
        
        # 3.2 Površina
        m2_poslovni = extras.get("m2_poslovni") or extras.get("m2", "")
        m2_stambeni = extras.get("m2_stambeni", "")
        lbl = _find_label(page2, "poslovni prostor")
        if lbl and m2_poslovni:
            _draw_text(page2, f"{m2_poslovni}", lbl.x1 + 130, lbl.y1 - 1, fontsize=FONT, max_width=60)
        lbl = _find_label(page2, "stambeni prostor")
        if lbl and m2_stambeni:
            _draw_text(page2, f"{m2_stambeni}", lbl.x1 + 130, lbl.y1 - 1, fontsize=FONT, max_width=60)
        
        # 5. Datum početka rada
        datum_pocetka = extras.get("datum_pocetka_rada", today)
        lbl = _find_label(page2, "5. Datum početka rada")
        if not lbl:
            lbl = _find_label(page2, "Datum početka rada")
        if lbl:
            ext = _find_label(page2, "fillimit të punës")
            x_start = (ext.x1 if ext else lbl.x1) + 8
            _draw_text(page2, datum_pocetka, x_start, lbl.y1 - 1, fontsize=FONT, max_width=180)
    
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
    FONT = 11
    
    def find_in_zone(page, text, y_min=0, y_max=10000):
        rects = page.search_for(text)
        for r in rects:
            if y_min <= r.y0 <= y_max:
                return r
        return None
    
    # 1) Tip prijave: X kraj odgovarajuće linije
    tip = (extras.get("tip_prijave") or "pocetak").lower()
    pocetak_lbl = _find_label(page1, "početak obavljanja trgovine")
    if pocetak_lbl and tip == "pocetak":
        _draw_text(page1, "X", pocetak_lbl.x0 - 15, pocetak_lbl.y1 - 2, fontsize=12)
    promjena_lbl = _find_label(page1, "promjena  podataka iz prijave")
    if promjena_lbl and tip == "promjena":
        _draw_text(page1, "X", promjena_lbl.x0 - 15, promjena_lbl.y1 - 2, fontsize=12)
    
    # 2) 1.1. Naziv/ime
    lbl = _find_label(page1, "1.1. Naziv /ime")
    if lbl:
        _draw_text(page1, naziv, lbl.x1 + 8, lbl.y1 - 1, fontsize=FONT, max_width=380)
    
    # 3) 1.2. Sjedište + adresa — koristi y zonu da nađe pravu "adresa" labelu
    lbl = _find_label(page1, "1.2. Sjedište")
    if lbl:
        _draw_text(page1, grad, lbl.x1 + 8, lbl.y1 - 1, fontsize=FONT, max_width=140)
        adr = find_in_zone(page1, "adresa", lbl.y0 - 5, lbl.y0 + 20)
        if adr:
            _draw_text(page1, adresa, adr.x1 + 8, adr.y1 - 1, fontsize=FONT, max_width=200)
    
    # 4) 1.3. Broj i datum rješenja — labela ima 2 reda (do "Subjekata"), value ispod
    lbl = _find_label(page1, "1.3. Broj i datum rješenja")
    if lbl and (maticni or crps_datum):
        line = f"{maticni}  {crps_datum}".strip()
        # "Subjekata" je drugi red labele na y≈307-320, pa pišemo y≈336 (ispod druge linije)
        sub = _find_label(page1, "Subjekata")
        y_pos = (sub.y1 + 14) if sub else (lbl.y1 + 30)
        _draw_text(page1, line, lbl.x0 + 5, y_pos, fontsize=FONT, max_width=350)
    
    # 5) 1.4. Šifra djelatnosti  
    lbl = _find_label(page1, "1.4. Šifra dijelatnosti")
    if lbl:
        _draw_text(page1, sifra_dj, lbl.x1 + 8, lbl.y1 - 1, fontsize=FONT, max_width=200)
    
    # 6) 1.5. Ime lica ovlašćenog za zastupanje i JMB — full label ide do "i JMB" x=312
    lbl = _find_label(page1, "1.5. Ime lica ovlašćenog")
    if lbl:
        jmb = _find_label(page1, "i JMB")
        x_start = (jmb.x1 if jmb else lbl.x1 + 220) + 8
        line = f"{direktor} {direktor_jmbg}".strip() if direktor_jmbg else direktor
        _draw_text(page1, line, x_start, lbl.y1 - 1, fontsize=FONT, max_width=200)
    
    # 7) 1.6. Žiro račun/i i poslovna banka — full label
    lbl = _find_label(page1, "1.6. Žiro  račun/i i poslovna banka")
    if not lbl:
        lbl = _find_label(page1, "1.6. Žiro")
    if lbl:
        _draw_text(page1, ziro, lbl.x1 + 8, lbl.y1 - 1, fontsize=FONT, max_width=250)
    
    # 8) 1.7. PIB — full label
    lbl = _find_label(page1, "1.7. Poreski identifikacijoni  broj")
    if not lbl:
        lbl = _find_label(page1, "1.7. Poreski identifikacijoni")
    if lbl:
        _draw_text(page1, pib, lbl.x1 + 8, lbl.y1 - 1, fontsize=FONT, max_width=250)
    
    # 9) Telefon, fax, e-mail
    lbl = _find_label(page1, "1.6. Telefon, fax, e-mail")
    if lbl:
        line = ", ".join(x for x in [tel, email] if x)
        _draw_text(page1, line, lbl.x1 + 8, lbl.y1 - 1, fontsize=FONT, max_width=300)
    
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
                _draw_text(page1, "X", lbl.x0 - 15, lbl.y1 - 2, fontsize=12)
    
    # 11) Vrsta robe / trgovinske usluge — text (ispod kolone)
    if extras.get("vrsta_robe"):
        lbl = _find_label(page1, "Vrsta robe /trgovinske  usluge:*")
        if not lbl:
            lbl = _find_label(page1, "Vrsta robe")
        if lbl:
            _draw_text(page1, extras["vrsta_robe"], lbl.x0, lbl.y1 + 20, fontsize=FONT, max_width=200)
    
    # 12) 3.1 Sjedište + adresa prostorije
    sjediste_obj = extras.get("sjediste_objekta") or grad
    naziv_obj = extras.get("naziv_objekta", "")
    adresa_obj = extras.get("adresa_objekta") or adresa
    if naziv_obj:
        adresa_obj = f"{naziv_obj} – {adresa_obj}" if adresa_obj else naziv_obj
    lbl = _find_label(page1, "3.1.Sjedište")
    if lbl:
        _draw_text(page1, sjediste_obj, lbl.x1 + 8, lbl.y1 - 1, fontsize=FONT, max_width=160)
        # adresa: scope to same row
        adr = find_in_zone(page1, "adresa:", lbl.y0 - 5, lbl.y0 + 20)
        if adr:
            _draw_text(page1, adresa_obj, adr.x1 + 8, adr.y1 - 1, fontsize=FONT, max_width=200)
    
    # ============ PAGE 2 ============
    if doc.page_count > 1:
        page2 = doc[1]
        
        # 3.2 Vrsta prostorije + m²
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
                    _draw_text(page2, "X", lbl.x0 - 15, lbl.y1 - 2, fontsize=12)
                    _draw_text(page2, str(m2_val), 488, lbl.y1 - 1, fontsize=FONT, max_width=30)
        
        # Lokacija
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
                    _draw_text(page2, "X", lbl.x0 - 15, lbl.y1 - 2, fontsize=12)
        
        # 5. Datum početka rada — pišemo nakon "rada1)" oznake
        datum_pocetka = extras.get("datum_pocetka_rada", "")
        if datum_pocetka:
            lbl = _find_label(page2, "5.Datum početka  rada1)")
            if not lbl:
                lbl = _find_label(page2, "rada1)")
            if not lbl:
                lbl = _find_label(page2, "5.Datum početka")
            if lbl:
                _draw_text(page2, datum_pocetka, lbl.x1 + 12, lbl.y1 - 1, fontsize=FONT, max_width=200)
        
        # 6. Vrsta i opis promjene
        if tip == "promjena" and extras.get("opis_promjene"):
            lbl = _find_label(page2, "6.Vrsta i opis promjene")
            if lbl:
                _draw_text(page2, extras["opis_promjene"], lbl.x1 + 12, lbl.y1 - 1, fontsize=FONT, max_width=280)
        
        # 7. Datum nastanka promjene
        if tip == "promjena" and extras.get("datum_promjene"):
            lbl = _find_label(page2, "7.Datum nastanka promjene iz prijave 2)")
            if not lbl:
                lbl = _find_label(page2, "7.Datum nastanka")
            if lbl:
                _draw_text(page2, extras["datum_promjene"], lbl.x1 + 12, lbl.y1 - 1, fontsize=FONT, max_width=200)
        
        # 8. Datum podnošenja prijave — nakon "prijave"
        datum_podnosenja = extras.get("datum_podnosenja") or today
        lbl = _find_label(page2, "8.Datum podnošenja prijave")
        if not lbl:
            lbl = _find_label(page2, "8.Datum podnošenja")
        if lbl:
            _draw_text(page2, datum_podnosenja, lbl.x1 + 12, lbl.y1 - 1, fontsize=FONT, max_width=200)
        
        # Potpis: ime i prezime direktora
        lbl = _find_label(page2, "ime i prezime i potpis")
        if lbl and direktor:
            _draw_text(page2, direktor, lbl.x0, lbl.y0 - 14, fontsize=FONT, max_width=200)
    
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
