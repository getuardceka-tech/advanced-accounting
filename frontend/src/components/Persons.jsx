import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users, MagnifyingGlass, Plus, PencilSimple, Trash, ArrowSquareOut,
  Spinner, X, Check, Printer,
} from "@phosphor-icons/react";
import api from "@/lib/api";

const empEmpty = {
  company_id: "",
  ime: "", prezime: "", jmbg: "", licna_karta: "", adresa: "", grad: "",
  pozicija: "", strucna_sprema: "", plata_bruto: 0, plata_neto: 0,
  datum_pocetka: "", datum_kraja: "", datum_prestanka: "",
  vrsta_ugovora: "neodredjeno", radno_vrijeme: "puno", sati_sedmicno: 40,
  telefon: "", email: "", aktivan: true,
};

export default function Persons() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [companyFilter, setCompanyFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empEmpty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (companyFilter) params.company_id = companyFilter;
      const [pr, cr] = await Promise.all([
        api.get("/persons", { params }),
        api.get("/companies"),
      ]);
      setItems(pr.data);
      setCompanies(cr.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [search, companyFilter]); // eslint-disable-line

  const openCreate = () => {
    setEditing(null);
    setForm({ ...empEmpty, company_id: companyFilter || "" });
    setError("");
    setModalOpen(true);
  };

  const openEdit = (p) => {
    setEditing(p);
    setForm({ ...empEmpty, ...p });
    setError("");
    setModalOpen(true);
  };

  const save = async () => {
    if (!form.ime || !form.prezime || !form.company_id) {
      setError("Ime, prezime i firma su obavezni");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        plata_bruto: Number(form.plata_bruto) || 0,
        plata_neto: Number(form.plata_neto) || 0,
        sati_sedmicno: Number(form.sati_sedmicno) || 40,
      };
      if (editing) {
        await api.put(`/employees/${editing.id}`, payload);
      } else {
        await api.post(`/employees`, payload);
      }
      setModalOpen(false);
      load();
    } catch (e) {
      setError(e.response?.data?.detail || "Greška");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (p) => {
    if (!window.confirm(`Obrisati ${p.ime} ${p.prezime}?`)) return;
    await api.delete(`/employees/${p.id}`);
    load();
  };

  const printUgovor = async (p, opts = {}) => {
    if (!p.id || !p.company_id) return;
    try {
      const r = await api.post("/documents/generate", {
        template_filename: "UGOVOR O RADU Zaposlenih.docx",
        company_id: p.company_id,
        employee_id: p.id,
      });
      if (r.data?.pdf_filename) {
        const tokenStr = localStorage.getItem("token") || "";
        const url = `${process.env.REACT_APP_BACKEND_URL}/api/documents/preview/${encodeURIComponent(r.data.pdf_filename)}?token=${tokenStr}`;
        window.open(url, "_blank");
        if (opts.closeModal) setModalOpen(false);
      } else {
        alert("PDF nije mogao da se generiše");
      }
    } catch (e) {
      alert(`Greška: ${e.response?.data?.detail || e.message}`);
    }
  };

  const saveAndPrint = async () => {
    if (!form.ime || !form.prezime || !form.company_id) {
      setError("Ime, prezime i firma su obavezni");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        plata_bruto: Number(form.plata_bruto) || 0,
        plata_neto: Number(form.plata_neto) || 0,
        sati_sedmicno: Number(form.sati_sedmicno) || 40,
      };
      let savedPerson;
      if (editing) {
        await api.put(`/employees/${editing.id}`, payload);
        savedPerson = { ...editing, ...payload };
      } else {
        const r = await api.post(`/employees`, payload);
        savedPerson = r.data;
      }
      await printUgovor(savedPerson, { closeModal: true });
      load();
    } catch (e) {
      setError(e.response?.data?.detail || "Greška");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div data-testid="persons-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Fizička lica · evidencija svih zaposlenih</h1>
          <p className="page-subtitle">
            {items.length} {items.length === 1 ? "lice" : "lica"} u centralnoj evidenciji
          </p>
        </div>
        <button className="btn btn-primary" onClick={openCreate} data-testid="add-person-btn">
          <Plus size={15} /> Dodaj fizičko lice
        </button>
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <div className="topbar-search" style={{ maxWidth: 360, flex: 1, minWidth: 240 }}>
          <MagnifyingGlass size={15} color="var(--text-tertiary)" />
          <input
            placeholder="Pretraži po imenu, JMBG-u, poziciji..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="persons-search"
          />
        </div>
        <select
          className="select"
          style={{ width: 280 }}
          value={companyFilter}
          onChange={(e) => setCompanyFilter(e.target.value)}
          data-testid="company-filter"
        >
          <option value="">Sve firme ({companies.length})</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>{c.naziv}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="empty"><Spinner size={28} className="spin" /></div>
      ) : items.length === 0 ? (
        <div className="empty">
          <div className="empty-icon"><Users size={24} /></div>
          <div className="empty-title">Nema unesenih fizičkih lica</div>
          <div className="empty-text">
            Dodajte zaposlene da možete brže generisati ugovore, odluke i ostale dokumente.
          </div>
          <button className="btn btn-primary" onClick={openCreate}>
            <Plus size={14} /> Dodaj prvo fizičko lice
          </button>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Ime i prezime</th>
                <th>JMBG</th>
                <th>Firma</th>
                <th>Radno mjesto</th>
                <th>Plata</th>
                <th style={{ width: 100 }}></th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id} data-testid={`person-row-${p.id}`}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: 6, background: "var(--bg-surface-hover)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 11, fontWeight: 700, flexShrink: 0,
                      }}>
                        {p.ime?.[0]?.toUpperCase()}{p.prezime?.[0]?.toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 500, fontSize: 13.5 }}>{p.ime} {p.prezime}</div>
                        {p.adresa && (
                          <div style={{ fontSize: 11.5, color: "var(--text-tertiary)" }}>{p.adresa}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 12.5 }}>{p.jmbg || "—"}</td>
                  <td>
                    <button
                      onClick={() => navigate(`/firme/${p.company_id}`)}
                      style={{
                        border: "none", background: "none", padding: 0,
                        color: "var(--accent)", fontSize: 12.5, cursor: "pointer",
                        textAlign: "left", display: "flex", alignItems: "center", gap: 4,
                      }}
                      title="Otvori firmu"
                    >
                      {p.company_naziv} <ArrowSquareOut size={11} />
                    </button>
                    {p.company_pib && (
                      <div style={{ fontSize: 11, color: "var(--text-tertiary)", fontFamily: "JetBrains Mono, monospace" }}>
                        PIB {p.company_pib}
                      </div>
                    )}
                  </td>
                  <td>
                    {p.pozicija ? (
                      <span className="badge badge-blue">{p.pozicija}</span>
                    ) : <span style={{ color: "var(--text-tertiary)" }}>—</span>}
                  </td>
                  <td style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 12.5 }}>
                    {p.plata_bruto ? `${Number(p.plata_bruto).toFixed(2)} €` : "—"}
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                      <button onClick={() => printUgovor(p)} style={{ border: "none", background: "transparent", padding: 5, borderRadius: 4, color: "var(--accent)", cursor: "pointer", display: "flex" }} data-testid={`print-ugovor-${p.id}`} title="Štampaj ugovor o radu">
                        <Printer size={15} />
                      </button>
                      <button onClick={() => openEdit(p)} style={{ border: "none", background: "transparent", padding: 5, borderRadius: 4, color: "var(--text-secondary)", cursor: "pointer", display: "flex" }} data-testid={`edit-person-${p.id}`}>
                        <PencilSimple size={15} />
                      </button>
                      <button onClick={() => remove(p)} style={{ border: "none", background: "transparent", padding: 5, borderRadius: 4, color: "var(--danger-text)", cursor: "pointer", display: "flex" }}>
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
        <PersonModal
          form={form} setForm={setForm} editing={editing} companies={companies}
          onSave={save} onClose={() => setModalOpen(false)}
          onSaveAndPrint={saveAndPrint}
          saving={saving} error={error}
        />
      )}
    </div>
  );
}

function PersonModal({ form, setForm, editing, companies, onSave, onClose, onSaveAndPrint, saving, error }) {
  const u = (k, v) => setForm({ ...form, [k]: v });
  return (
    <div className="modal-backdrop" onClick={onClose} data-testid="person-modal">
      <div className="modal animate-slide-up" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 720 }}>
        <div className="modal-header">
          <div className="modal-title">{editing ? "Uredi fizičko lice" : "Novo fizičko lice"}</div>
          <button onClick={onClose} style={{ border: "none", background: "transparent", padding: 6 }}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <div style={{ padding: "10px 12px", background: "#f8fafc", borderRadius: 8, marginBottom: 16, fontSize: 12.5, color: "var(--text-secondary)", borderLeft: "3px solid #2563eb" }}>
            💡 <strong>Radno mjesto (pozicija)</strong> se automatski povezuje sa ugovorima, odlukama o pauzi, godišnjem odmoru i ostalim dokumentima — popunite je da izbjegnete ručno unošenje.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div className="field-group" style={{ gridColumn: "1/-1" }}>
              <label className="field-label">Firma * (gdje je lice zaposleno)</label>
              <select
                className="select" value={form.company_id || ""}
                onChange={(e) => u("company_id", e.target.value)}
                data-testid="person-company-select"
              >
                <option value="">— Odaberi firmu —</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.naziv} ({c.pib})</option>
                ))}
              </select>
            </div>
            <Field label="Ime *" value={form.ime} onChange={(v) => u("ime", v)} testid="person-ime" />
            <Field label="Prezime *" value={form.prezime} onChange={(v) => u("prezime", v)} testid="person-prezime" />
            <Field label="JMBG" value={form.jmbg} onChange={(v) => u("jmbg", v)} testid="person-jmbg" />
            <Field label="Lična karta" value={form.licna_karta} onChange={(v) => u("licna_karta", v)} />
            <Field label="Adresa stanovanja" value={form.adresa} onChange={(v) => u("adresa", v)} />
            <Field label="Grad" value={form.grad} onChange={(v) => u("grad", v)} />
            <Field label="Radno mjesto (pozicija) ⭐" value={form.pozicija} onChange={(v) => u("pozicija", v)} testid="person-pozicija" />
            <Field label="Stručna sprema" value={form.strucna_sprema} onChange={(v) => u("strucna_sprema", v)} />
            <Field label="Bruto plata (€)" value={form.plata_bruto} onChange={(v) => u("plata_bruto", v)} type="number" />
            <Field label="Neto plata (€)" value={form.plata_neto} onChange={(v) => u("plata_neto", v)} type="number" />
            <Field label="Datum početka rada" value={form.datum_pocetka} onChange={(v) => u("datum_pocetka", v)} type="date" />
            <div className="field-group">
              <label className="field-label">Vrsta ugovora</label>
              <select className="select" value={form.vrsta_ugovora} onChange={(e) => u("vrsta_ugovora", e.target.value)} data-testid="person-vrsta">
                <option value="neodredjeno">Na neodređeno</option>
                <option value="odredjeno">Na određeno</option>
              </select>
            </div>
            <div className="field-group">
              <label className="field-label">Sati sedmično</label>
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  className="input"
                  type="number"
                  min="1" max="40"
                  value={form.sati_sedmicno ?? 40}
                  onChange={(e) => {
                    const v = Number(e.target.value) || 40;
                    setForm({ ...form, sati_sedmicno: v, radno_vrijeme: v < 40 ? "skraceno" : "puno" });
                  }}
                  data-testid="person-sati"
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setForm({ ...form, sati_sedmicno: 40, radno_vrijeme: "puno" })}
                  style={{ fontSize: 11.5, padding: "4px 8px" }}
                >40h</button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setForm({ ...form, sati_sedmicno: 20, radno_vrijeme: "skraceno" })}
                  style={{ fontSize: 11.5, padding: "4px 8px" }}
                >20h</button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setForm({ ...form, sati_sedmicno: 10, radno_vrijeme: "skraceno" })}
                  style={{ fontSize: 11.5, padding: "4px 8px" }}
                >10h</button>
              </div>
              <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>
                {form.sati_sedmicno >= 40 ? "Puno radno vrijeme" : `Skraćeno radno vrijeme — ${form.sati_sedmicno}h sedmično`}
              </div>
            </div>
            {form.vrsta_ugovora === "odredjeno" && (
              <Field label="Datum kraja ugovora (određeno)" value={form.datum_kraja} onChange={(v) => u("datum_kraja", v)} type="date" testid="person-datum-kraja" />
            )}
            <Field label="Datum prestanka rada (za odjavu)" value={form.datum_prestanka} onChange={(v) => u("datum_prestanka", v)} type="date" testid="person-datum-prestanka" />
            <Field label="Telefon" value={form.telefon} onChange={(v) => u("telefon", v)} />
            <Field label="Email" value={form.email} onChange={(v) => u("email", v)} />
          </div>
          {error && (
            <div style={{ marginTop: 14, padding: "10px 12px", background: "var(--danger-bg)", color: "var(--danger-text)", borderRadius: 6, fontSize: 13 }}>
              {error}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Odustani</button>
          <button
            className="btn btn-secondary"
            onClick={onSaveAndPrint}
            disabled={saving || !form.ime || !form.prezime || !form.company_id}
            data-testid="save-and-print-ugovor-btn"
            title="Sačuvaj i odmah generiši ugovor o radu"
          >
            <Printer size={14} />
            Sačuvaj i štampaj ugovor
          </button>
          <button className="btn btn-primary" onClick={onSave} disabled={saving} data-testid="save-person-btn">
            {saving ? <Spinner size={14} className="spin" /> : <Check size={14} />}
            Sačuvaj
          </button>
        </div>
      </div>
    </div>
  );
}

const Field = ({ label, value, onChange, testid, type = "text" }) => (
  <div className="field-group">
    <label className="field-label">{label}</label>
    <input className="input" type={type} value={value ?? ""} onChange={(e) => onChange(e.target.value)} data-testid={testid} />
  </div>
);
