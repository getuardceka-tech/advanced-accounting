import { useEffect, useState } from "react";
import { Check, Spinner } from "@phosphor-icons/react";
import api from "@/lib/api";

export default function AgencySettings() {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");

  useEffect(() => {
    api.get("/agency").then((r) => setForm(r.data));
  }, []);

  const u = (k, v) => setForm({ ...form, [k]: v });

  const save = async () => {
    setSaving(true);
    setSavedMsg("");
    try {
      await api.put("/agency", form);
      setSavedMsg("Sačuvano ✓");
      setTimeout(() => setSavedMsg(""), 2500);
    } catch (e) {
      setSavedMsg("Greška: " + (e.response?.data?.detail || ""));
    } finally {
      setSaving(false);
    }
  };

  if (!form) return <div className="empty"><Spinner size={28} className="spin" /></div>;

  return (
    <div data-testid="agency-settings-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Moja agencija</h1>
          <p className="page-subtitle">Podaci agencije se koriste pri generisanju dokumenata</p>
        </div>
        <button className="btn btn-primary" onClick={save} disabled={saving} data-testid="save-agency-btn">
          {saving ? <Spinner size={14} className="spin" /> : <Check size={14} />}
          Sačuvaj izmjene
        </button>
      </div>

      {savedMsg && (
        <div style={{ marginBottom: 16, padding: "10px 14px", background: savedMsg.startsWith("Greška") ? "var(--danger-bg)" : "var(--success-bg)", color: savedMsg.startsWith("Greška") ? "var(--danger-text)" : "var(--success-text)", borderRadius: 6, fontSize: 13 }}>
          {savedMsg}
        </div>
      )}

      <div className="card card-padded" style={{ maxWidth: 800 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <Field full label="Naziv agencije" value={form.naziv} onChange={(v) => u("naziv", v)} testid="agency-naziv" />
          <Field label="Adresa" value={form.adresa} onChange={(v) => u("adresa", v)} testid="agency-adresa" />
          <Field label="Grad" value={form.grad} onChange={(v) => u("grad", v)} testid="agency-grad" />
          <Field label="PIB" value={form.pib} onChange={(v) => u("pib", v)} />
          <Field label="PDV broj" value={form.pdv_broj} onChange={(v) => u("pdv_broj", v)} />

          <div style={{ gridColumn: "1/-1", borderTop: "1px solid var(--border)", paddingTop: 14, marginTop: 6 }}>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-tertiary)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>
              Direktor / Vlasnik
            </div>
          </div>
          <Field label="Ime i prezime direktora" value={form.direktor_ime} onChange={(v) => u("direktor_ime", v)} testid="agency-direktor" />
          <Field label="JMBG direktora" value={form.direktor_jmbg} onChange={(v) => u("direktor_jmbg", v)} testid="agency-jmbg" />

          <div style={{ gridColumn: "1/-1", borderTop: "1px solid var(--border)", paddingTop: 14, marginTop: 6 }}>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-tertiary)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>
              Bankovni i kontakt podaci
            </div>
          </div>
          <Field label="Žiro račun" value={form.ziro_racun} onChange={(v) => u("ziro_racun", v)} />
          <Field label="Banka" value={form.banka} onChange={(v) => u("banka", v)} />
          <Field label="Telefon" value={form.telefon} onChange={(v) => u("telefon", v)} />
          <Field label="Email" value={form.email} onChange={(v) => u("email", v)} />
          <Field full label="Djelatnost" value={form.djelatnost} onChange={(v) => u("djelatnost", v)} />
        </div>
      </div>
    </div>
  );
}

const Field = ({ label, value, onChange, testid, full }) => (
  <div className="field-group" style={full ? { gridColumn: "1/-1" } : {}}>
    <label className="field-label">{label}</label>
    <input className="input" value={value || ""} onChange={(e) => onChange(e.target.value)} data-testid={testid} />
  </div>
);
