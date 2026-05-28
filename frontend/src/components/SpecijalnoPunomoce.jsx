import { useState } from "react";
import { Plus, Spinner, Printer, FileText, Download, CheckCircle, X, Check } from "@phosphor-icons/react";
import api from "@/lib/api";

const initial = {
  davaoc_ime_prezime: "",
  davaoc_is_stranac: false,
  davaoc_jmb: "",
  davaoc_pasos: "",
  davaoc_drzava: "Crne Gore",
  davaoc_adresa: "",
  firma_naziv: "",
  punomocnik_ime_prezime: "",
  punomocnik_jmb: "",
  punomocnik_adresa: "",
  datum: new Date().toISOString().slice(0, 10),
};

export default function SpecijalnoPunomoce() {
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  
  const u = (k, v) => setForm({ ...form, [k]: v });
  
  const validate = () => {
    if (!form.davaoc_ime_prezime) return "Ime i prezime davaoca punomoćja je obavezno";
    if (!form.davaoc_is_stranac && !form.davaoc_jmb) return "JMBG je obavezan za domaće lice";
    if (form.davaoc_is_stranac && !form.davaoc_pasos) return "Broj pasoša je obavezan za stranog davaoca";
    if (!form.firma_naziv) return "Naziv firme koja se osniva je obavezan";
    return null;
  };
  
  const generate = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setError("");
    setBusy(true);
    setResult(null);
    try {
      const r = await api.post("/punomoce/generate", form);
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
    <div data-testid="specijalno-punomocje-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Specijalno punomoćje</h1>
          <p className="page-subtitle">
            Generiše punomoćje za osnivanje firme — popunjava sve žute oznake u šablonu sa unesenim podacima.
          </p>
        </div>
      </div>
      
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        {/* === DAVAOC PUNOMOĆJA === */}
        <Section icon={Plus} title="1. Davalac punomoćja (osoba koja daje ovlaštenje)" color="#3b82f6">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Field label="Ime i prezime *" value={form.davaoc_ime_prezime} onChange={(v) => u("davaoc_ime_prezime", v.toUpperCase())} testid="pun-ime" placeholder="Ime i prezime" />
            <Field label="Adresa prebivališta *" value={form.davaoc_adresa} onChange={(v) => u("davaoc_adresa", v)} testid="pun-adresa" placeholder="Ulica, broj, grad" />
            
            <div className="field-group" style={{ gridColumn: "1/-1", padding: 12, background: form.davaoc_is_stranac ? "#fef3c7" : "#f0fdf4", borderRadius: 8, border: `1px solid ${form.davaoc_is_stranac ? "#fbbf24" : "#86efac"}` }}>
              <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 13.5, fontWeight: 500 }}>
                <input
                  type="checkbox"
                  checked={form.davaoc_is_stranac}
                  onChange={(e) => u("davaoc_is_stranac", e.target.checked)}
                  data-testid="pun-is-stranac"
                  style={{ width: 18, height: 18 }}
                />
                {form.davaoc_is_stranac ? "🌍 Strani državljanin (koristi se broj pasoša)" : "🇲🇪 Crnogorski državljanin (koristi se JMBG)"}
              </label>
            </div>
            
            {form.davaoc_is_stranac ? (
              <>
                <Field label="Broj pasoša *" value={form.davaoc_pasos} onChange={(v) => u("davaoc_pasos", v)} testid="pun-pasos" placeholder="Broj pasoša" />
                <Field label="Država porijekla" value={form.davaoc_drzava} onChange={(v) => u("davaoc_drzava", v)} placeholder="Albanije, Italije..." />
              </>
            ) : (
              <>
                <Field label="JMBG *" value={form.davaoc_jmb} onChange={(v) => u("davaoc_jmb", v)} testid="pun-jmb" placeholder="13-cifreni JMBG" />
                <Field label="Država" value={form.davaoc_drzava} onChange={(v) => u("davaoc_drzava", v)} placeholder="Crne Gore" />
              </>
            )}
          </div>
        </Section>
        
        {/* === FIRMA === */}
        <Section icon={FileText} title="2. Firma koja se osniva" color="#10b981">
          <Field 
            label="Naziv firme *" 
            value={form.firma_naziv} 
            onChange={(v) => u("firma_naziv", v.toUpperCase())} 
            testid="pun-firma"
            placeholder='Npr. DOO "MARKO TRADE" ULCINJ'
          />
        </Section>
        
        {/* === PUNOMOĆNIK === */}
        <Section icon={Plus} title="3. Punomoćnik (osoba kojoj se daje ovlaštenje)" color="#8b5cf6">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Field label="Ime i prezime punomoćnika" value={form.punomocnik_ime_prezime} onChange={(v) => u("punomocnik_ime_prezime", v.toUpperCase())} testid="pun-pun-ime" placeholder="Računovođa, advokat..." />
            <Field label="JMBG punomoćnika" value={form.punomocnik_jmb} onChange={(v) => u("punomocnik_jmb", v)} testid="pun-pun-jmb" placeholder="13-cifreni JMBG" />
            <div style={{ gridColumn: "1/-1" }}>
              <Field label="Adresa punomoćnika (opciono)" value={form.punomocnik_adresa} onChange={(v) => u("punomocnik_adresa", v)} placeholder="Ulica, broj, grad" />
            </div>
            <Field label="Datum punomoćja" value={form.datum} onChange={(v) => u("datum", v)} type="date" testid="pun-datum" />
          </div>
        </Section>
        
        {error && (
          <div style={{ marginTop: 14, padding: "12px 14px", background: "var(--danger-bg, #fee2e2)", color: "var(--danger-text, #991b1b)", borderRadius: 8, fontSize: 13.5 }} data-testid="pun-error">
            ⚠️ {error}
          </div>
        )}
        
        <div style={{ marginTop: 24, marginBottom: 20, display: "flex", justifyContent: "center", gap: 12 }}>
          <button
            className="btn btn-primary"
            onClick={generate}
            disabled={busy}
            data-testid="pun-generate-btn"
            style={{ fontSize: 14.5, padding: "12px 28px" }}
          >
            {busy ? <Spinner size={16} className="spin" /> : <Printer size={16} />}
            {busy ? "Generišem dokument..." : "Generiši specijalno punomoćje"}
          </button>
        </div>
        
        {result?.filename && (
          <div style={{ marginTop: 30, padding: 20, background: "white", borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.05)", border: "1px solid var(--border)" }} data-testid="pun-result">
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <CheckCircle size={22} color="#10b981" weight="fill" />
              <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Specijalno punomoćje generisano za: {form.davaoc_ime_prezime}</h3>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                className="btn btn-primary"
                onClick={() => openFile(result.preview_url)}
                data-testid="pun-open-pdf"
              >
                <Printer size={14} /> Otvori PDF (za štampu)
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => openFile(result.download_url)}
                data-testid="pun-open-docx"
              >
                <Download size={14} /> Preuzmi Word (.docx)
              </button>
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
