import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  MagnifyingGlass,
  FunnelSimple,
  Trash,
  PencilSimple,
  ArrowSquareOut,
  X,
  DownloadSimple,
  Check,
  Spinner,
  ArrowsClockwise,
} from "@phosphor-icons/react";
import api from "@/lib/api";

const empty = {
  naziv: "",
  pib: "",
  naziv_skraceni: "",
  maticni_broj: "",
  pdv_broj: "",
  adresa: "",
  grad: "",
  djelatnost: "",
  sifra_djelatnosti: "",
  direktor_ime: "",
  direktor_jmbg: "",
  direktor_adresa: "",
  ziro_racun: "",
  banka: "",
  telefon: "",
  email: "",
  pdv_obveznik: false,
  ioppd_obveznik: false,
  aktivna: true,
  napomena: "",
  oblik_organizovanja: "",
  irms_status: "",
  irms_checked_at: "",
  datum_registracije: "",
};

export default function Companies() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all"); // all/pdv/ioppd
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null); // company object or null
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupMsg, setLookupMsg] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (filter === "pdv") params.pdv_only = true;
      if (filter === "ioppd") params.ioppd_only = true;
      const r = await api.get("/companies", { params });
      setItems(r.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line
  }, [search, filter]);

  const openCreate = () => {
    setEditing(null);
    setForm(empty);
    setError("");
    setLookupMsg("");
    setModalOpen(true);
  };

  const openEdit = (c) => {
    setEditing(c);
    setForm({ ...empty, ...c });
    setError("");
    setLookupMsg("");
    setModalOpen(true);
  };

  const save = async () => {
    if (!form.naziv || !form.pib) {
      setError("Naziv i PIB su obavezni");
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (editing) {
        await api.put(`/companies/${editing.id}`, form);
      } else {
        await api.post("/companies", form);
      }
      setModalOpen(false);
      load();
    } catch (e) {
      setError(e.response?.data?.detail || "Greška pri snimanju");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (c) => {
    if (!window.confirm(`Obrisati firmu "${c.naziv}"? Svi povezani zaposleni će biti obrisani.`)) return;
    await api.delete(`/companies/${c.id}`);
    load();
  };

  const lookupIRMS = async (overridePib) => {
    const pib = (overridePib || form.pib || "").trim();
    if (!pib) {
      setError("Unesite PIB prvo");
      return;
    }
    setLookupBusy(true);
    setLookupMsg("");
    try {
      const r = await api.get(`/companies/lookup-pib?pib=${pib}`);
      if (r.data.success && r.data.data) {
        const data = r.data.data;
        const status = data.status || "";
        setForm((f) => ({
          ...f,
          naziv: data.naziv || f.naziv,
          naziv_skraceni: data.naziv_skraceni || f.naziv_skraceni,
          maticni_broj: data.maticni_broj || f.maticni_broj,
          adresa: data.adresa || f.adresa,
          grad: data.grad || f.grad,
          djelatnost: data.djelatnost || f.djelatnost,
          sifra_djelatnosti: data.sifra_djelatnosti || f.sifra_djelatnosti,
          direktor_ime: data.direktor_ime || f.direktor_ime,
          telefon: data.telefon || f.telefon,
          email: data.email || f.email,
          oblik_organizovanja: data.oblik_organizovanja || f.oblik_organizovanja,
          datum_registracije: data.datum_registracije || f.datum_registracije,
          irms_status: status,
          irms_checked_at: new Date().toISOString(),
        }));
        // Obojen status banner
        if (status === "Registrovan") {
          setLookupMsg(`✓ Podaci preuzeti sa IRMS portala (Status: Registrovan)`);
        } else if (status) {
          setLookupMsg(`⚠ PAŽNJA — IRMS status firme: ${status}. Firma možda nije aktivna.`);
        } else {
          setLookupMsg(`✓ Podaci preuzeti sa IRMS portala`);
        }
      } else {
        setLookupMsg(
          r.data.message ||
            "IRMS trenutno ne vraća automatske podatke. Otvori IRMS portal ručno."
        );
      }
    } catch (e) {
      setLookupMsg("Greška pri pretrazi IRMS portala");
    } finally {
      setLookupBusy(false);
    }
  };
  
  // Auto-lookup kad korisnik završi unos PIB-a (debounce 700ms + min 6 cifara)
  // Samo za kreiranje (ne za izmjenu postojeće firme).
  useEffect(() => {
    if (editing) return; // ne radi auto-lookup u edit modu
    if (!modalOpen) return;
    const pib = (form.pib || "").trim();
    if (!pib || !/^\d{6,}$/.test(pib)) return;
    // Već imamo popunjen naziv (vjerovatno već radio lookup) → ne ponavljaj
    if (form.naziv && form.naziv.length > 3) return;
    const t = setTimeout(() => {
      lookupIRMS(pib);
    }, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line
  }, [form.pib, modalOpen, editing]);

  return (
    <div data-testid="companies-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Firme klijenti</h1>
          <p className="page-subtitle">
            {items.length} {items.length === 1 ? "firma" : "firmi"} u bazi
          </p>
        </div>
        <button className="btn btn-primary" onClick={openCreate} data-testid="add-company-btn">
          <Plus size={15} /> Dodaj firmu
        </button>
      </div>

      <div
        style={{
          display: "flex",
          gap: 12,
          marginBottom: 16,
          alignItems: "center",
        }}
      >
        <div className="topbar-search" style={{ maxWidth: 400, flex: 1 }}>
          <MagnifyingGlass size={15} color="var(--text-tertiary)" />
          <input
            placeholder="Pretraži po nazivu, PIB-u, direktoru..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="companies-search"
          />
        </div>
        <div style={{ display: "flex", gap: 4, background: "white", padding: 4, borderRadius: 7, border: "1px solid var(--border)" }}>
          {[
            { v: "all", label: "Sve" },
            { v: "pdv", label: "PDV" },
            { v: "ioppd", label: "IOPPD" },
          ].map((f) => (
            <button
              key={f.v}
              onClick={() => setFilter(f.v)}
              data-testid={`filter-${f.v}`}
              style={{
                padding: "5px 12px",
                fontSize: 12.5,
                fontWeight: 500,
                border: "none",
                borderRadius: 4,
                background: filter === f.v ? "#0f172a" : "transparent",
                color: filter === f.v ? "white" : "var(--text-secondary)",
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="empty" data-testid="companies-loading">
          <Spinner size={28} className="spin" />
          <div className="empty-text" style={{ marginTop: 12 }}>Učitavam...</div>
        </div>
      ) : items.length === 0 ? (
        <div className="empty" data-testid="companies-empty">
          <div className="empty-icon">
            <FunnelSimple size={24} />
          </div>
          <div className="empty-title">Nema firmi za prikaz</div>
          <div className="empty-text">
            {search ? "Nema rezultata za pretragu. " : "Počnite dodavanjem prve firme. "}
          </div>
          <button className="btn btn-primary" onClick={openCreate}>
            <Plus size={14} /> Dodaj firmu
          </button>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Naziv</th>
                <th>PIB</th>
                <th>Direktor</th>
                <th>Grad</th>
                <th>Status</th>
                <th style={{ width: 100 }}></th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => navigate(`/firme/${c.id}`)}
                  className="clickable"
                  data-testid={`company-row-${c.pib}`}
                >
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 6,
                          background: "var(--bg-surface-hover)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 11,
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        {c.naziv?.[0]?.toUpperCase()}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 500, fontSize: 13.5 }}>{c.naziv}</div>
                        {c.djelatnost && (
                          <div style={{ fontSize: 11.5, color: "var(--text-tertiary)" }}>
                            {c.djelatnost.slice(0, 50)}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 12.5 }}>{c.pib}</td>
                  <td style={{ fontSize: 12.5 }}>{c.direktor_ime || "—"}</td>
                  <td style={{ fontSize: 12.5 }}>{c.grad || "—"}</td>
                  <td>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {c.pdv_obveznik && <span className="badge badge-blue">PDV</span>}
                      {c.ioppd_obveznik && <span className="badge badge-neutral">IOPPD</span>}
                      {!c.aktivna && <span className="badge badge-danger">Neaktivna</span>}
                      {c.irms_status && c.irms_status !== "Registrovan" && (
                        <span
                          className="badge"
                          style={{ background: "#fef2f2", color: "#991b1b", border: "1px solid #fca5a5" }}
                          title={`IRMS status: ${c.irms_status}`}
                        >
                          ⚠ {c.irms_status}
                        </span>
                      )}
                    </div>
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                      <button
                        className="btn-ghost"
                        onClick={() => openEdit(c)}
                        title="Uredi"
                        style={{ border: "none", background: "transparent", padding: 5, borderRadius: 4, color: "var(--text-secondary)", cursor: "pointer", display: "flex" }}
                        data-testid={`edit-company-${c.pib}`}
                      >
                        <PencilSimple size={15} />
                      </button>
                      <button
                        className="btn-ghost"
                        onClick={() => remove(c)}
                        title="Obriši"
                        style={{ border: "none", background: "transparent", padding: 5, borderRadius: 4, color: "var(--danger-text)", cursor: "pointer", display: "flex" }}
                        data-testid={`delete-company-${c.pib}`}
                      >
                        <Trash size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <CompanyModal
          form={form}
          setForm={setForm}
          editing={editing}
          onSave={save}
          onClose={() => setModalOpen(false)}
          saving={saving}
          error={error}
          onLookup={lookupIRMS}
          lookupBusy={lookupBusy}
          lookupMsg={lookupMsg}
        />
      )}
    </div>
  );
}

function CompanyModal({ form, setForm, editing, onSave, onClose, saving, error, onLookup, lookupBusy, lookupMsg }) {
  const u = (k, v) => setForm({ ...form, [k]: v });

  return (
    <div className="modal-backdrop" onClick={onClose} data-testid="company-modal">
      <div className="modal animate-slide-up" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 760 }}>
        <div className="modal-header">
          <div className="modal-title">
            {editing ? "Uredi firmu" : "Nova firma"}
          </div>
          <button className="btn-ghost" onClick={onClose} style={{ border: "none", background: "transparent", padding: 6, borderRadius: 6 }} data-testid="close-modal">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {/* PIB + IRMS lookup */}
          <div style={{ background: "#f8fafc", border: "1px solid var(--border)", padding: 14, borderRadius: 8, marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 10 }}>
              <div className="field-group" style={{ flex: 1 }}>
                <label className="field-label">PIB / Matični broj *</label>
                <input
                  className="input"
                  value={form.pib}
                  onChange={(e) => u("pib", e.target.value)}
                  placeholder="npr. 03801969"
                  data-testid="form-pib"
                />
              </div>
              <button
                className="btn btn-secondary"
                onClick={() => onLookup()}
                disabled={lookupBusy || !form.pib}
                data-testid="irms-lookup-btn"
                title="Automatski preuzmi podatke firme sa IRMS portala"
              >
                {lookupBusy ? <Spinner size={14} className="spin" /> : <ArrowsClockwise size={14} />}
                {lookupBusy ? "Učitavam..." : "Auto popuni"}
              </button>
              <a
                href={`https://irms.tax.gov.me/public/search-register/business-entities`}
                target="_blank"
                rel="noreferrer"
                className="btn btn-ghost"
                title="Otvori IRMS portal (Poreska uprava)"
                data-testid="open-irms-link"
              >
                <ArrowSquareOut size={14} />
                IRMS
              </a>
              <a
                href={`https://www.biznisregistri.me`}
                target="_blank"
                rel="noreferrer"
                className="btn btn-ghost"
                title="Otvori CRPS portal (Centralni registar privrednih subjekata)"
                data-testid="open-crps-link"
              >
                <ArrowSquareOut size={14} />
                CRPS
              </a>
            </div>
            {lookupMsg && (
              <div
                style={{
                  marginTop: 10,
                  padding: "10px 12px",
                  borderRadius: 6,
                  fontSize: 12.5,
                  fontWeight: lookupMsg.startsWith("⚠") ? 600 : 500,
                  background: lookupMsg.startsWith("✓")
                    ? "var(--success-bg)"
                    : lookupMsg.startsWith("⚠")
                    ? "#fef2f2"
                    : "var(--warning-bg)",
                  color: lookupMsg.startsWith("✓")
                    ? "var(--success-text)"
                    : lookupMsg.startsWith("⚠")
                    ? "#991b1b"
                    : "var(--warning-text)",
                  border: lookupMsg.startsWith("⚠") ? "1px solid #fca5a5" : "none",
                }}
                data-testid="lookup-msg"
              >
                {lookupMsg}
              </div>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Field label="Naziv firme *" value={form.naziv} onChange={(v) => u("naziv", v)} testid="form-naziv" full />
            <Field label="Skraćeni naziv" value={form.naziv_skraceni} onChange={(v) => u("naziv_skraceni", v)} testid="form-naziv-skraceni" />
            <Field label="Matični broj" value={form.maticni_broj} onChange={(v) => u("maticni_broj", v)} testid="form-maticni" />
            <Field label="PDV broj" value={form.pdv_broj} onChange={(v) => u("pdv_broj", v)} testid="form-pdv-broj" />
            <Field label="Šifra djelatnosti" value={form.sifra_djelatnosti} onChange={(v) => u("sifra_djelatnosti", v)} testid="form-sifra" />
            <Field label="Djelatnost" value={form.djelatnost} onChange={(v) => u("djelatnost", v)} testid="form-djelatnost" full />
            <Field label="Adresa" value={form.adresa} onChange={(v) => u("adresa", v)} testid="form-adresa" />
            <Field label="Grad" value={form.grad} onChange={(v) => u("grad", v)} testid="form-grad" />

            <div style={{ gridColumn: "1/-1", borderTop: "1px solid var(--border)", paddingTop: 14, marginTop: 6 }}>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-tertiary)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>
                Direktor
              </div>
            </div>
            <Field label="Ime i prezime direktora" value={form.direktor_ime} onChange={(v) => u("direktor_ime", v)} testid="form-direktor-ime" />
            <Field label="JMBG direktora" value={form.direktor_jmbg} onChange={(v) => u("direktor_jmbg", v)} testid="form-direktor-jmbg" />
            <Field label="Adresa direktora" value={form.direktor_adresa} onChange={(v) => u("direktor_adresa", v)} testid="form-direktor-adresa" full />

            <div style={{ gridColumn: "1/-1", borderTop: "1px solid var(--border)", paddingTop: 14, marginTop: 6 }}>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-tertiary)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>
                Bankovni i kontakt podaci
              </div>
            </div>
            <Field label="Žiro račun" value={form.ziro_racun} onChange={(v) => u("ziro_racun", v)} testid="form-ziro" />
            <Field label="Banka" value={form.banka} onChange={(v) => u("banka", v)} testid="form-banka" />
            <Field label="Telefon" value={form.telefon} onChange={(v) => u("telefon", v)} testid="form-telefon" />
            <Field label="Email" value={form.email} onChange={(v) => u("email", v)} testid="form-email" />

            <div style={{ gridColumn: "1/-1", borderTop: "1px solid var(--border)", paddingTop: 14, marginTop: 6 }}>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-tertiary)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>
                Status
              </div>
              <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                <Toggle label="PDV obveznik" checked={form.pdv_obveznik} onChange={(v) => u("pdv_obveznik", v)} testid="form-pdv-obveznik" />
                <Toggle label="Aktivna firma" checked={form.aktivna} onChange={(v) => u("aktivna", v)} testid="form-aktivna" />
              </div>
              <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginTop: 8, fontStyle: "italic" }}>
                IOPPD: automatski uključuje sve firme osim preduzetnika bez zaposlenih.
              </div>
            </div>

            <div style={{ gridColumn: "1/-1" }}>
              <label className="field-label">Napomena</label>
              <textarea
                className="textarea"
                value={form.napomena}
                onChange={(e) => u("napomena", e.target.value)}
                rows={2}
                data-testid="form-napomena"
              />
            </div>
          </div>

          {error && (
            <div style={{ marginTop: 14, padding: "10px 12px", background: "var(--danger-bg)", color: "var(--danger-text)", borderRadius: 6, fontSize: 13 }} data-testid="form-error">
              {error}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Odustani</button>
          <button className="btn btn-primary" onClick={onSave} disabled={saving} data-testid="save-company-btn">
            {saving ? <Spinner size={14} className="spin" /> : <Check size={14} />}
            {editing ? "Sačuvaj" : "Dodaj firmu"}
          </button>
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

const Toggle = ({ label, checked, onChange, testid }) => (
  <button
    type="button"
    onClick={() => onChange(!checked)}
    data-testid={testid}
    style={{
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "6px 10px",
      border: "1px solid var(--border)",
      borderRadius: 6,
      background: checked ? "#0f172a" : "white",
      color: checked ? "white" : "var(--text-primary)",
      fontSize: 13,
      fontWeight: 500,
    }}
  >
    <div
      style={{
        width: 14,
        height: 14,
        border: `1.5px solid ${checked ? "white" : "var(--border-strong)"}`,
        borderRadius: 3,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {checked && <Check size={10} weight="bold" color="white" />}
    </div>
    {label}
  </button>
);
