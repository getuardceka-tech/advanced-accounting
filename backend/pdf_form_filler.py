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
                              agency: Dict[str, Any] = None,
                              extras: Dict[str, Any] = None) -> bool:
    """Popuni Zahtjev za uzorkovanje. Koristi apsolutne koordinate izvučene iz user-ovih
    ručno popunjenih reference PDF-ova (BRIS, HRANA, VODA, BAZENI).
    """
    agency = agency or {}
    extras = extras or {}
    doc = fitz.open(str(input_pdf))
    page = doc[0]
    
    fname = input_pdf.name.lower()
    is_voda = "voda" in fname
    is_hrana = "hrana" in fname
    is_brisev = "brisev" in fname or "bris" in fname
    is_bazen = "bazen" in fname
    
    naziv = company.get("naziv", "")  # PUNI naziv firme za podnosioca zahtjeva
    naziv_skraceni = (company.get("naziv_skraceni") or "").strip() or naziv
    # Naziv objekta: prvenstveno user input, inače skraćeni naziv firme
    naziv_objekta = (extras.get("naziv_objekta") or "").strip() or naziv_skraceni
    adresa_objekta = (extras.get("adresa_objekta") or "").strip() or company.get("adresa", "")
    
    adresa = company.get("adresa", "")
    grad = company.get("grad", "") or "Ulcinj"
    pib = company.get("pib", "")
    pdv = company.get("pdv_broj", "") or ""
    sifra_dj = company.get("sifra_djelatnosti", "")
    tel = company.get("telefon", "") or agency.get("telefon", "")
    email = company.get("email", "") or agency.get("email", "")
    direktor = (extras.get("kontakt_osoba") or "").strip() or company.get("direktor_ime", "")
    
    FONT = 11
    # PyMuPDF insert_text koristi BASELINE y, dok user reference y0 = top of bbox.
    # Pomak: baseline = y_top + fontsize → dodaj FONT pixela na sve y vrijednosti
    Y = lambda y: y + FONT
    
    if is_voda:
        # VODA layout — 2 kolone (lijevo + desno)
        _draw_text(page, naziv, 305, Y(192), fontsize=FONT, max_width=240)                 # Podnosilac zahtjeva — PUNI naziv
        _draw_text(page, naziv_objekta, 156, Y(234), fontsize=FONT, max_width=220)         # Naziv objekta — user input
        _draw_text(page, sifra_dj, 470, Y(234), fontsize=FONT, max_width=100)              # Djelatnost
        _draw_text(page, adresa_objekta, 121, Y(258), fontsize=FONT, max_width=240)        # Adresa
        _draw_text(page, grad, 428, Y(258), fontsize=FONT, max_width=130)                  # Grad
        _draw_text(page, pib, 95, Y(282), fontsize=FONT, max_width=240)                    # PIB
        _draw_text(page, pdv, 425, Y(282), fontsize=FONT, max_width=140)                   # PDV
        _draw_text(page, direktor, 226, Y(308), fontsize=FONT, max_width=320)              # Ime kontakt osobe
        _draw_text(page, tel, 133, Y(331), fontsize=FONT, max_width=240)                   # Broj telefona
        _draw_text(page, email, 426, Y(335), fontsize=FONT, max_width=140)                 # e-mail
    
    elif is_hrana:
        # HRANA layout — single kolona
        adresa_obj = f"{naziv_objekta}, {adresa_objekta}".rstrip(", ")
        _draw_text(page, adresa_obj, 95, Y(240), fontsize=FONT, max_width=420)             # Podaci o objektu (naziv objekta + adresa)
        _draw_text(page, naziv, 80, Y(398), fontsize=FONT, max_width=460)                  # Naziv (PUNI — podnosilac zahtjeva)
        _draw_text(page, adresa, 116, Y(419), fontsize=FONT, max_width=420)                # Adresa firme
        _draw_text(page, pib, 120, Y(439), fontsize=FONT, max_width=240)                   # PIB
        _draw_text(page, pdv, 120, Y(454), fontsize=FONT, max_width=240)                   # PDV
        _draw_text(page, tel, 137, Y(475), fontsize=FONT, max_width=400)                   # Kontakt tel
    
    elif is_brisev:
        # BRISEVA layout — single kolona
        adresa_obj = f"{naziv_objekta}, {adresa_objekta}".rstrip(", ")
        _draw_text(page, adresa_obj, 91, Y(213), fontsize=FONT, max_width=420)             # Podaci o objektu (naziv objekta)
        _draw_text(page, naziv, 93, Y(313), fontsize=FONT, max_width=420)                  # Naziv (PUNI — podnosilac zahtjeva)
        _draw_text(page, adresa, 119, Y(346), fontsize=FONT, max_width=420)                # Adresa firme
        _draw_text(page, pib, 121, Y(373), fontsize=FONT, max_width=240)                   # PIB
        _draw_text(page, pdv, 119, Y(403), fontsize=FONT, max_width=240)                   # PDV
        _draw_text(page, tel, 172, Y(431), fontsize=FONT, max_width=380)                   # Kontakt tel/FAX
    
    else:
        # BAZENI ili fallback — koristi originalnu label-based logiku
        adresa_full = f"{adresa}, {grad}" if adresa and grad else (adresa or grad or "")
        lbl = _find_label(page, "Podaci o objektu")
        if lbl:
            _draw_text(page, f"{naziv_skraceni}, {adresa_full}".rstrip(", "),
                       lbl.x1 + 8, lbl.y1 - 1, fontsize=FONT, max_width=420)
        lbl = _find_label(page, "Naziv (institucija")
        if lbl:
            _draw_text(page, naziv, lbl.x0 - 153, lbl.y1 + 16, fontsize=FONT, max_width=440)
        lbl = _find_label(page, "Adresa:")
        if lbl:
            _draw_text(page, adresa_full, lbl.x1 + 4, lbl.y1 - 1, fontsize=FONT, max_width=420)
        lbl = _find_label(page, "PIB:")
        if lbl:
            _draw_text(page, pib, lbl.x1 + 4, lbl.y1 - 1, fontsize=FONT, max_width=200)
        lbl = _find_label(page, "PDV:")
        if lbl:
            _draw_text(page, pdv or "", lbl.x1 + 4, lbl.y1 - 1, fontsize=FONT, max_width=200)
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
    
    # PRIJAVA ZANATSTVA — koristi skraćeni naziv samo ako je puni predugačak za štampu
    # Limit: ~50 chars za 1 red. Ako je duže, pokušaj redom: naziv_skraceni (ako kratak) → auto-skratiti → wrap
    naziv_full = company.get("naziv", "")
    naziv_skraceni = (company.get("naziv_skraceni") or "").strip()
    NAZIV_LIMIT = 50
    
    if len(naziv_full) <= NAZIV_LIMIT:
        naziv = naziv_full
    elif naziv_skraceni and len(naziv_skraceni) <= NAZIV_LIMIT:
        naziv = naziv_skraceni
    else:
        # Auto-skrati: izvuci dio između navodnika + suffix DOO/AD
        import re
        m = re.search(r'"([^"]+)"', naziv_full)
        suffix_m = re.search(r'\b(D\.O\.O\.?|DOO|AD|A\.D\.?)\b', naziv_full.upper())
        suffix = suffix_m.group(1).replace(".", "") if suffix_m else ""
        if m:
            naziv = f'{suffix} {m.group(1)}'.strip()
        else:
            naziv = naziv_full[:NAZIV_LIMIT].rstrip(", ") + "…"
    
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
    
    # Tip prijave: X — desno od kraja BILINGUAL naslova, na crtici ___
    tip = (extras.get("tip_prijave") or "pocetak").lower()
    if tip == "pocetak":
        # "ushtrimit të zejtarisë 1)" je kraj 1. reda 
        ext = _find_label(page1, "ushtrimit të zejtarisë 1)") or _find_label(page1, "zejtarisë 1)")
        x_pos = (ext.x1 + 15) if ext else 484
        y_pos = (ext.y1 - 1) if ext else 313
        _draw_text(page1, "X", x_pos, y_pos, fontsize=13, max_width=20)
    else:
        # "fletëparaqitja 2)" je kraj 2. reda
        ext = _find_label(page1, "fletëparaqitja 2)") or _find_label(page1, "fletëparaqitja")
        x_pos = (ext.x1 + 15) if ext else 546
        y_pos = (ext.y1 - 1) if ext else 327
        _draw_text(page1, "X", x_pos, y_pos, fontsize=13, max_width=20)
    
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
    
    # PRIJAVA TRGOVINE — UVIJEK koristi puni naziv (ima dovoljno prostora za 2 reda)
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
    
    # Tip prijave: X — manji, lijevo, TAČNO na crtici ___ poslije "trgovine 1)" / "iz prijave2)"
    tip = (extras.get("tip_prijave") or "pocetak").lower()
    if tip == "pocetak":
        lbl = _find_label(page1, "-početak obavljanja trgovine 1)")
        x_pos = (lbl.x1 + 12) if lbl else 385
        y_pos = (lbl.y1 - 1) if lbl else 156
        _draw_text(page1, "X", x_pos, y_pos, fontsize=12, max_width=20)
    else:
        lbl = _find_label(page1, "-promjena  podataka iz prijave2)")
        if not lbl:
            lbl = _find_label(page1, "promjena  podataka iz prijave")
        x_pos = (lbl.x1 + 12) if lbl else 388
        y_pos = (lbl.y1 - 1) if lbl else 171
        _draw_text(page1, "X", x_pos, y_pos, fontsize=12, max_width=20)
    
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
    
    # Vrsta trgovine — X iza odgovarajuće labele + Vrsta robe text na istom redu
    vrsta_trg = (extras.get("vrsta_trgovine") or "").lower()
    vrsta_map = {
        "veliko": "-trgovina na veliko",
        "malo": "-trgovina na malo",
        "distanciona": "Distanciona",
        "usluge": "-trgovinske usluge",
    }
    vrsta_robe_y = None
    for k, label_text in vrsta_map.items():
        if k in vrsta_trg:
            lbl = _find_label(page1, label_text)
            if lbl:
                # X odmah poslije labele
                _draw_text(page1, "X", lbl.x1 + 16, lbl.y1 - 1, fontsize=13, max_width=20)
                vrsta_robe_y = lbl.y1 - 1
            break
    
    # Vrsta robe / trgovinske usluge — text u DESNOJ koloni, ISTI red kao X za vrstu trgovine
    if extras.get("vrsta_robe") and vrsta_robe_y:
        _draw_text(page1, extras["vrsta_robe"], 304, vrsta_robe_y, fontsize=FONT, max_width=240)
    
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
        
        # Vrsta prostorije + m² — X na 20-25px posle stvarne dužine labele
        prostor_data = [
            ("m2_prodavnica",     "-prodavnica"),
            ("m2_skladiste",      "-skladište"),
            ("m2_stovariste",     "-stovarište"),
            ("m2_drugo",          "-drugo prodajno mesto"),
            ("m2_usluge_prostor", "prostorija za obavljanje trgovinskih usluga"),
            ("m2_pijaca",         "pijaca i dr.prostori"),
        ]
        for key, label_text in prostor_data:
            m2_val = extras.get(key)
            if m2_val:
                lbl = _find_label(page2, label_text)
                if lbl:
                    _draw_text(page2, "X", lbl.x1 + 22, lbl.y1 - 1, fontsize=13, max_width=20)
                    _draw_text(page2, str(m2_val), 479, lbl.y1 - 1, fontsize=FONT, max_width=40)
        
        # Lokacija (u zatvorenom / na otvorenom / na pijaci) — X odmah poslije labele
        lokacija = (extras.get("lokacija") or "").lower()
        loc_map = {
            "zatvor":  "u zatvorenom prostoru",
            "otvoren": "na otvorenom prostoru",
            "pijac":   "na pijaci",
        }
        for k, label_text in loc_map.items():
            if k in lokacija:
                lbl = _find_label(page2, label_text)
                if lbl:
                    _draw_text(page2, "X", lbl.x1 + 22, lbl.y1 - 1, fontsize=13, max_width=20)
        
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
        return _fill_zahtjev_uzorkovanje(src, output_pdf, company, agency, extras)
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
