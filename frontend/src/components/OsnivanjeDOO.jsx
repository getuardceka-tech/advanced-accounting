import { useState, useEffect } from "react";
import { Plus, Spinner, Printer, FileText, Download, CheckCircle, MagnifyingGlass, Check, X } from "@phosphor-icons/react";
import api from "@/lib/api";

const initial = {
  // Osnivač
  osnivac_ime_prezime: "",
  osnivac_is_stranac: false,
  osnivac_jmb: "",
  osnivac_pasos: "",
  osnivac_drzava: "Crne Gore",
  osnivac_adresa: "",
  osnivac_datum_rodjenja: "",
  osnivac_procenat: 100,
  
  // Firma
  firma_naziv_pun: "",
  firma_naziv_skraceni: "",
  firma_naziv_pecat: "",
  firma_vrsta_djelatnosti_opis: "ZA PROIZVODNJU, PROMET I USLUGE",
  firma_sjediste_adresa: "",
  firma_grad: "ULCINJ",
  firma_telefon: "",
  firma_email: "",
  firma_sifra_djelatnosti: "47.11",
  firma_naziv_djelatnosti: "Nespecijalizovana trgovina na malo pretežno hranom, pićima I duvanskim proizvodima",
  
  // Direktor
  direktor_isti_kao_osnivac: true,
  direktor_ime_prezime: "",
  direktor_is_stranac: false,
  direktor_jmb: "",
  direktor_pasos: "",
  direktor_drzava: "Crne Gore",
  direktor_adresa: "",
  
  // Datumi
  datum_odluke: new Date().toISOString().slice(0, 10),
  osnovni_kapital: 1.0,
  direktor_pol: "M",  // M = muško (saglasan), Z = žensko (saglasna)
  
  // Punomoćnik (Član 8.1 Odluke o osnivanju)
  podnosi_punomocnik: false,
  punomocnik_ime_prezime: "",
  punomocnik_jmbg: "",
  punomocnik_adresa: "",
};

export default function OsnivanjeDOO() {
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [templates, setTemplates] = useState([]);
  const [showSaveTpl, setShowSaveTpl] = useState(false);
  const [tplName, setTplName] = useState("");
  
  useEffect(() => {
    api.get("/founding/templates").then((r) => setTemplates(r.data || [])).catch(() => {});
  }, []);
  
  const loadTemplate = (tpl) => {
    setForm({ ...initial, ...tpl.data });
    setResult(null);
  };
  
  const saveAsTemplate = async () => {
    if (!tplName.trim()) return;
    try {
      const r = await api.post("/founding/templates", { template_name: tplName.trim(), data: form });
      setTemplates([r.data, ...templates]);
      setShowSaveTpl(false);
      setTplName("");
      alert(`Šablon "${r.data.template_name}" sačuvan! Možete ga ponovo koristiti za drugu firmu.`);
    } catch (e) {
      alert(`Greška: ${e.response?.data?.detail || e.message}`);
    }
  };
  
  const deleteTemplate = async (id, name) => {
    if (!confirm(`Obrisati šablon "${name}"?`)) return;
    await api.delete(`/founding/templates/${id}`);
    setTemplates(templates.filter((t) => t.id !== id));
  };
  
  const u = (k, v) => setForm({ ...form, [k]: v });
  
  const validate = () => {
    if (!form.osnivac_ime_prezime) return "Ime i prezime osnivača je obavezno";
    if (!form.osnivac_is_stranac && !form.osnivac_jmb) return "JMBG osnivača je obavezan za domaće lice";
    if (form.osnivac_is_stranac && !form.osnivac_pasos) return "Broj pasoša je obavezan za stranog osnivača";
    if (!form.osnivac_adresa) return "Adresa osnivača je obavezna";
    if (!form.firma_naziv_pun) return "Pun naziv firme je obavezan";
    if (!form.firma_naziv_skraceni) return "Skraćeni naziv firme je obavezan";
    if (!form.firma_sjediste_adresa) return "Sjedište firme je obavezno";
    if (!form.direktor_isti_kao_osnivac && !form.direktor_ime_prezime) return "Ime direktora je obavezno";
    if (form.podnosi_punomocnik) {
      if (!form.punomocnik_ime_prezime) return "Ime i prezime punomoćnika je obavezno";
      if (!form.punomocnik_jmbg) return "JMBG punomoćnika je obavezan";
    }
    return null;
  };
  
  const generate = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setError("");
    setBusy(true);
    setResult(null);
    try {
      const payload = {
        ...form,
        osnivac_procenat: Number(form.osnivac_procenat) || 100,
        osnovni_kapital: Number(form.osnovni_kapital) || 1.0,
      };
      const r = await api.post("/founding/generate", payload);
      setResult(r.data);
    } catch (e) {
      setError(e.response?.data?.detail || e.message);
    } finally {
      setBusy(false);
    }
  };
  
  const openFile = (urlPath) => {
    const tokenStr = localStorage.getItem("token") || "";
    const url = `${process.env.REACT_APP_BACKEND_URL}${urlPath}${urlPath.includes("?") ? "&" : "?"}token=${tokenStr}`;
    window.open(url, "_blank");
  };
  
  return (
    <div data-testid="osnivanje-doo-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Osnivanje DOO firme</h1>
          <p className="page-subtitle">
            Unesi podatke jednom — generišu se 4 dokumenta: Odluka o osnivanju, Imenovanje direktora, Saglasnost i Statut.
          </p>
        </div>
      </div>
      
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        {/* === ŠABLONI === */}
        <div style={{ marginBottom: 20, background: "white", border: "1px solid var(--border)", borderRadius: 12, padding: 16, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>
            <Download size={15} />
            Sačuvani šabloni:
          </div>
          {templates.length === 0 && (
            <div style={{ fontSize: 12.5, color: "var(--text-tertiary)" }}>
              Nema sačuvanih šablona. Popuni formu i klikni "Sačuvaj kao šablon".
            </div>
          )}
          {templates.map((t) => (
            <div key={t.id} style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#eff6ff", color: "#1e40af", padding: "4px 4px 4px 10px", borderRadius: 999, fontSize: 12.5, border: "1px solid #93c5fd" }}>
              <button onClick={() => loadTemplate(t)} style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", padding: 0, fontSize: 12.5, fontWeight: 500 }} data-testid={`load-tpl-${t.id}`}>
                {t.template_name}
              </button>
              <button onClick={() => deleteTemplate(t.id, t.template_name)} style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", padding: 2, marginLeft: 2 }} title="Obriši šablon">
                ×
              </button>
            </div>
          ))}
          <div style={{ marginLeft: "auto" }}>
            {!showSaveTpl ? (
              <button 
                className="btn btn-secondary" 
                onClick={() => setShowSaveTpl(true)} 
                style={{ fontSize: 12.5, padding: "5px 12px" }}
                data-testid="save-as-tpl-btn"
              >
                <Plus size={12} /> Sačuvaj kao šablon
              </button>
            ) : (
              <div style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                <input
                  className="input"
                  placeholder="Naziv šablona (npr. ELA&ART)"
                  value={tplName}
                  onChange={(e) => setTplName(e.target.value)}
                  autoFocus
                  data-testid="tpl-name-input"
                  style={{ height: 30, padding: "4px 8px", fontSize: 12.5, minWidth: 200 }}
                />
                <button onClick={saveAsTemplate} className="btn btn-primary" style={{ padding: "5px 10px", fontSize: 12 }} data-testid="confirm-save-tpl">
                  <Check size={12} />
                </button>
                <button onClick={() => { setShowSaveTpl(false); setTplName(""); }} className="btn btn-secondary" style={{ padding: "5px 8px" }}>
                  <X size={12} />
                </button>
              </div>
            )}
          </div>
        </div>
        
        {/* === OSNIVAČ === */}
        <Section icon={Plus} title="1. Osnivač firme" color="#3b82f6">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Field label="Ime i prezime osnivača *" value={form.osnivac_ime_prezime} onChange={(v) => u("osnivac_ime_prezime", v.toUpperCase())} testid="osn-ime" placeholder="Ime i prezime" />
            <Field label="Adresa prebivališta *" value={form.osnivac_adresa} onChange={(v) => u("osnivac_adresa", v)} testid="osn-adresa" placeholder="Ulica, broj, grad" />
            
            <div className="field-group" style={{ gridColumn: "1/-1", padding: 12, background: form.osnivac_is_stranac ? "#fef3c7" : "#f0fdf4", borderRadius: 8, border: `1px solid ${form.osnivac_is_stranac ? "#fbbf24" : "#86efac"}` }}>
              <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 13.5, fontWeight: 500 }}>
                <input
                  type="checkbox"
                  checked={form.osnivac_is_stranac}
                  onChange={(e) => u("osnivac_is_stranac", e.target.checked)}
                  data-testid="osn-is-stranac"
                  style={{ width: 18, height: 18 }}
                />
                {form.osnivac_is_stranac ? "🌍 Strani državljanin (koristi se broj pasoša)" : "🇲🇪 Crnogorski državljanin (koristi se JMBG)"}
              </label>
            </div>
            
            {form.osnivac_is_stranac ? (
              <>
                <Field label="Broj pasoša *" value={form.osnivac_pasos} onChange={(v) => u("osnivac_pasos", v)} testid="osn-pasos" placeholder="Broj pasoša" />
                <Field label="Država porijekla" value={form.osnivac_drzava} onChange={(v) => u("osnivac_drzava", v)} placeholder="Albanije, Italije..." />
              </>
            ) : (
              <>
                <Field label="JMBG *" value={form.osnivac_jmb} onChange={(v) => u("osnivac_jmb", v)} testid="osn-jmb" placeholder="13-cifreni JMBG" />
                <Field label="Država" value={form.osnivac_drzava} onChange={(v) => u("osnivac_drzava", v)} placeholder="Crne Gore" />
              </>
            )}
            
            <Field label="Datum rođenja (za saglasnost)" value={form.osnivac_datum_rodjenja} onChange={(v) => u("osnivac_datum_rodjenja", v)} type="date" testid="osn-datum-rod" />
            <Field label="% udjela osnivača" value={form.osnivac_procenat} onChange={(v) => u("osnivac_procenat", v)} type="number" />
          </div>
        </Section>
        
        {/* === FIRMA === */}
        <Section icon={FileText} title="2. Podaci o firmi koja se osniva" color="#10b981">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div style={{ gridColumn: "1/-1" }}>
              <Field 
                label='Pun naziv firme *' 
                value={form.firma_naziv_pun} 
                onChange={(v) => u("firma_naziv_pun", v.toUpperCase())}
                testid="firma-naziv-pun"
                placeholder='Pun naziv firme'
              />
            </div>
            <Field 
              label='Skraćeni naziv *' 
              value={form.firma_naziv_skraceni} 
              onChange={(v) => u("firma_naziv_skraceni", v.toUpperCase())}
              testid="firma-naziv-skraceni"
              placeholder='Skraćeni naziv'
            />
            <Field 
              label='Naziv na pečatu (bez DOO)' 
              value={form.firma_naziv_pecat} 
              onChange={(v) => u("firma_naziv_pecat", v.toUpperCase())}
              testid="firma-pecat"
              placeholder="Naziv koji ide u pečat"
            />
            <div className="field-group" style={{ gridColumn: "1/-1" }}>
              <label className="field-label">Vrsta djelatnosti (opis u nazivu)</label>
              <select
                className="select"
                value={form.firma_vrsta_djelatnosti_opis}
                onChange={(e) => u("firma_vrsta_djelatnosti_opis", e.target.value)}
                data-testid="firma-djelatnost-opis"
              >
                <option value="ZA PROIZVODNJU, PROMET I USLUGE">ZA PROIZVODNJU, PROMET I USLUGE</option>
                <option value="ZA TRGOVINU">ZA TRGOVINU</option>
                <option value="ZA UGOSTITELJSTVO">ZA UGOSTITELJSTVO</option>
                <option value="ZA TURIZAM">ZA TURIZAM</option>
                <option value="ZA GRAĐEVINARSTVO">ZA GRAĐEVINARSTVO</option>
                <option value="ZA TRANSPORT">ZA TRANSPORT</option>
                <option value="ZA POSREDOVANJE I USLUGE">ZA POSREDOVANJE I USLUGE</option>
              </select>
              <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>
                Dio koji ide u pun naziv: "DRUŠTVO SA OGRANIČENOM ODGOVORNOŠĆU [ovaj dio] [pečat] ULCINJ"
              </div>
            </div>
            <Field label="Sjedište - puna adresa *" value={form.firma_sjediste_adresa} onChange={(v) => u("firma_sjediste_adresa", v.toUpperCase())} testid="firma-sjediste" placeholder="Ulica, broj, grad" />
            <Field label="Grad" value={form.firma_grad} onChange={(v) => u("firma_grad", v.toUpperCase())} placeholder="ULCINJ" />
            <Field label="Telefon" value={form.firma_telefon} onChange={(v) => u("firma_telefon", v)} testid="firma-tel" placeholder="+382 ..." />
            <Field label="Email" value={form.firma_email} onChange={(v) => u("firma_email", v)} testid="firma-email" placeholder="info@..." />
            <div style={{ gridColumn: "1/-1" }}>
              <SifraDjelatnostiSearch
                value={{ sifra: form.firma_sifra_djelatnosti, naziv: form.firma_naziv_djelatnosti }}
                onChange={(s) => setForm({ ...form, firma_sifra_djelatnosti: s.sifra, firma_naziv_djelatnosti: s.naziv })}
              />
            </div>
            <Field label="Osnovni kapital (€)" value={form.osnovni_kapital} onChange={(v) => u("osnovni_kapital", v)} type="number" />
            <Field label="Datum odluke o osnivanju" value={form.datum_odluke} onChange={(v) => u("datum_odluke", v)} type="date" />
          </div>
        </Section>
        
        {/* === DIREKTOR === */}
        <Section icon={Plus} title="3. Direktor firme" color="#8b5cf6">
          <div className="field-group" style={{ padding: 12, background: "#f0fdf4", borderRadius: 8, border: "1px solid #86efac", marginBottom: 14 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 13.5, fontWeight: 500 }}>
              <input
                type="checkbox"
                checked={form.direktor_isti_kao_osnivac}
                onChange={(e) => u("direktor_isti_kao_osnivac", e.target.checked)}
                data-testid="dir-isti"
                style={{ width: 18, height: 18 }}
              />
              ✅ Direktor je isto lice kao osnivač (najčešći slučaj)
            </label>
          </div>
          
          <div className="field-group" style={{ marginBottom: 14, padding: 12, background: "#eff6ff", borderRadius: 8, border: "1px solid #93c5fd" }}>
            <label className="field-label" style={{ marginBottom: 8 }}>Pol direktora (za saglasnost: saglasan / saglasna)</label>
            <div style={{ display: "flex", gap: 14 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13.5 }}>
                <input
                  type="radio"
                  name="direktor_pol"
                  checked={form.direktor_pol === "M"}
                  onChange={() => u("direktor_pol", "M")}
                  data-testid="dir-pol-m"
                />
                Muški (rodjen, saglasan)
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13.5 }}>
                <input
                  type="radio"
                  name="direktor_pol"
                  checked={form.direktor_pol === "Z"}
                  onChange={() => u("direktor_pol", "Z")}
                  data-testid="dir-pol-z"
                />
                Ženski (rodjena, saglasna)
              </label>
            </div>
          </div>
          
          {!form.direktor_isti_kao_osnivac && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Field label="Ime i prezime direktora *" value={form.direktor_ime_prezime} onChange={(v) => u("direktor_ime_prezime", v.toUpperCase())} />
              <Field label="Adresa prebivališta" value={form.direktor_adresa} onChange={(v) => u("direktor_adresa", v)} />
              <div style={{ gridColumn: "1/-1" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={form.direktor_is_stranac}
                    onChange={(e) => u("direktor_is_stranac", e.target.checked)}
                    style={{ width: 16, height: 16 }}
                  />
                  Direktor je strani državljanin
                </label>
              </div>
              {form.direktor_is_stranac
                ? <Field label="Broj pasoša direktora" value={form.direktor_pasos} onChange={(v) => u("direktor_pasos", v)} />
                : <Field label="JMBG direktora" value={form.direktor_jmb} onChange={(v) => u("direktor_jmb", v)} />}
              <Field label="Država" value={form.direktor_drzava} onChange={(v) => u("direktor_drzava", v)} />
            </div>
          )}
        </Section>
        
        {/* === PUNOMOĆNIK (Član 8.1 Odluke) === */}
        <Section icon={FileText} title="4. Punomoćnik (Član 8.1 Odluke)" color="#f59e0b">
          <div className="field-group" style={{ padding: 12, background: form.podnosi_punomocnik ? "#fef3c7" : "#f8fafc", borderRadius: 8, border: `1px solid ${form.podnosi_punomocnik ? "#fbbf24" : "var(--border)"}`, marginBottom: 14 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 13.5, fontWeight: 500 }}>
              <input
                type="checkbox"
                checked={form.podnosi_punomocnik}
                onChange={(e) => u("podnosi_punomocnik", e.target.checked)}
                data-testid="punomocnik-toggle"
                style={{ width: 18, height: 18 }}
              />
              {form.podnosi_punomocnik 
                ? "📝 Podnosim zahtjev preko PUNOMOĆNIKA (npr. računovođa, advokat)" 
                : "Osnivač sam podnosi zahtjev (bez punomoćnika)"}
            </label>
            <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginTop: 6, marginLeft: 28 }}>
              {form.podnosi_punomocnik 
                ? "Unesi podatke punomoćnika koji će zastupati osnivača u postupku osnivanja firme." 
                : "Ako se kasnije odlučiš za punomoćnika, štikliraj ovu opciju."}
            </div>
          </div>
          
          {form.podnosi_punomocnik && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Field 
                label="Ime i prezime punomoćnika *" 
                value={form.punomocnik_ime_prezime} 
                onChange={(v) => u("punomocnik_ime_prezime", v.toUpperCase())} 
                testid="punomocnik-ime"
                placeholder="Ime i prezime"
              />
              <Field 
                label="JMBG punomoćnika *" 
                value={form.punomocnik_jmbg} 
                onChange={(v) => u("punomocnik_jmbg", v)} 
                testid="punomocnik-jmbg"
                placeholder="13-cifreni JMBG"
              />
              <div style={{ gridColumn: "1/-1" }}>
                <Field 
                  label="Adresa punomoćnika (opciono)" 
                  value={form.punomocnik_adresa} 
                  onChange={(v) => u("punomocnik_adresa", v)} 
                  testid="punomocnik-adresa"
                  placeholder="Ulica, broj, grad"
                />
              </div>
            </div>
          )}
        </Section>
        
        {error && (
          <div style={{ marginTop: 14, padding: "12px 14px", background: "var(--danger-bg)", color: "var(--danger-text)", borderRadius: 8, fontSize: 13.5 }} data-testid="osn-error">
            ⚠️ {error}
          </div>
        )}
        
        <div style={{ marginTop: 24, marginBottom: 20, display: "flex", justifyContent: "center", gap: 12 }}>
          <button
            className="btn btn-primary"
            onClick={generate}
            disabled={busy}
            data-testid="osn-generate-btn"
            style={{ fontSize: 14.5, padding: "12px 28px" }}
          >
            {busy ? <Spinner size={16} className="spin" /> : <Printer size={16} />}
            {busy ? "Generišem 4 dokumenta..." : "Generiši sve dokumente"}
          </button>
        </div>
        
        {result?.files && (
          <div style={{ marginTop: 30, padding: 20, background: "white", borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.05)", border: "1px solid var(--border)" }} data-testid="osn-result">
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <CheckCircle size={22} color="#10b981" weight="fill" />
              <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Generisana dokumentacija za: {result.firma_naziv}</h3>
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              {result.files.map((f) => (
                <div key={f.filename} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", background: "#f8fafc", borderRadius: 8, border: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <FileText size={18} color="var(--accent)" />
                    <div style={{ fontWeight: 500, fontSize: 13.5 }}>{f.label}</div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      className="btn btn-secondary"
                      onClick={() => openFile(f.preview_url)}
                      style={{ fontSize: 12, padding: "5px 12px" }}
                      data-testid={`open-pdf-${f.slug}`}
                    >
                      <Printer size={13} /> PDF
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={() => openFile(f.download_url)}
                      style={{ fontSize: 12, padding: "5px 12px" }}
                      data-testid={`download-docx-${f.slug}`}
                    >
                      <Download size={13} /> Word
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const Section = ({ icon: Icon, title, color, children }) => (
  <div style={{ marginBottom: 20, background: "white", border: "1px solid var(--border)", borderRadius: 12, padding: 20, boxShadow: "0 1px 2px rgba(0,0,0,0.03)" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, paddingBottom: 12, borderBottom: "1px solid var(--border-light)" }}>
      <div style={{ width: 36, height: 36, borderRadius: 8, background: `${color}20`, color, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon size={18} weight="bold" />
      </div>
      <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>{title}</h3>
    </div>
    {children}
  </div>
);

const Field = ({ label, value, onChange, testid, type = "text", placeholder }) => (
  <div className="field-group">
    <label className="field-label">{label}</label>
    <input
      className="input"
      type={type}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      data-testid={testid}
    />
  </div>
);

function SifraDjelatnostiSearch({ value, onChange }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await api.get("/sifre-djelatnosti", { params: { q: query, limit: 80 } });
        setResults(r.data);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [query, open]);
  
  const pick = (s) => {
    onChange(s);
    setOpen(false);
    setQuery("");
  };
  
  return (
    <div className="field-group" style={{ position: "relative" }}>
      <label className="field-label">Pretežna djelatnost firme *</label>
      <div
        className="input"
        style={{ cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", minHeight: 40, padding: "8px 10px" }}
        onClick={() => setOpen(!open)}
        data-testid="sifra-djelatnosti-trigger"
      >
        {value.sifra ? (
          <div style={{ fontSize: 13 }}>
            <strong style={{ color: "var(--accent)", marginRight: 8 }}>{value.sifra}</strong>
            <span>{value.naziv}</span>
          </div>
        ) : (
          <span style={{ color: "var(--text-tertiary)" }}>Klikni za pretragu šifri djelatnosti...</span>
        )}
        <MagnifyingGlass size={15} color="var(--text-tertiary)" />
      </div>
      <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>
        Šifra ide u Statut i Odluku o osnivanju kao pretežna djelatnost.
      </div>
      
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
          background: "white", border: "1px solid var(--border)", borderRadius: 8,
          boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 100, maxHeight: 380, overflow: "auto"
        }}>
          <div style={{ padding: 10, borderBottom: "1px solid var(--border-light)", background: "#f8fafc", position: "sticky", top: 0 }}>
            <input
              className="input"
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Pretraži (npr: trgovina, gradj, ugost...)"
              data-testid="sifra-djelatnosti-search"
            />
          </div>
          {loading && <div style={{ padding: 14, textAlign: "center", color: "var(--text-tertiary)" }}>Učitavam...</div>}
          {!loading && results.length === 0 && (
            <div style={{ padding: 14, textAlign: "center", color: "var(--text-tertiary)", fontSize: 13 }}>
              Nema rezultata za "{query}"
            </div>
          )}
          {!loading && results.map((s) => (
            <div
              key={s.sifra}
              onClick={() => pick(s)}
              data-testid={`sifra-opt-${s.sifra}`}
              style={{
                padding: "10px 12px", borderBottom: "1px solid var(--border-light)",
                cursor: "pointer", display: "flex", gap: 10, alignItems: "flex-start",
                fontSize: 13
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "#f8fafc"}
              onMouseLeave={(e) => e.currentTarget.style.background = "white"}
            >
              <div style={{
                fontWeight: 600, color: "var(--accent)", fontFamily: "JetBrains Mono, monospace",
                fontSize: 12.5, minWidth: 50
              }}>{s.sifra}</div>
              <div style={{ flex: 1 }}>{s.naziv}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
