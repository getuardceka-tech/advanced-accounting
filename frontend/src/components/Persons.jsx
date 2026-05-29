import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users, MagnifyingGlass, Plus, PencilSimple, Trash, ArrowSquareOut,
  Spinner, X, Check, Printer,
} from "@phosphor-icons/react";
import api from "@/lib/api";

const empEmpty = {
  company_id: "",
  ime: "", prezime: "", jmbg: "", licna_karta: "", pasos: "",
  is_stranac: false, vrsta_isprave: "jmbg",
  adresa: "", grad: "",
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
  const [ponudaModal, setPonudaModal] = useState(null); // { person, type: 'nova'|'produzenje' }

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

  const printPonudaWithFields = async (person, type, fields, opts = {}) => {
    if (!person?.id || !person?.company_id) return;
    const template = type === "produzenje"
      ? "PISANA PONUDA ZA PRODUZENJE DOZVOLE ZA BORAVAK I RAD.docx"
      : "PISANA PONUDA ZA BORAVAK I RAD.docx";
    try {
      const r = await api.post("/documents/generate", {
        template_filename: template,
        company_id: person.company_id,
        employee_id: person.id,
        custom_fields: fields,
      });
      if (r.data?.pdf_filename) {
        const tokenStr = localStorage.getItem("token") || "";
        const url = `${process.env.REACT_APP_BACKEND_URL}/api/documents/preview/${encodeURIComponent(r.data.pdf_filename)}?token=${tokenStr}`;
        window.open(url, "_blank");
        if (opts.closeModal) setModalOpen(false);
        setPonudaModal(null);
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

  const saveAndPrintPonuda = async (type) => {
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
      load();
      setPonudaModal({ person: savedPerson, type });
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
          onSaveAndPrintPonuda={saveAndPrintPonuda}
          saving={saving} error={error}
        />
      )}
      {ponudaModal && (
        <PonudaModal
          person={ponudaModal.person}
          type={ponudaModal.type}
          onClose={() => setPonudaModal(null)}
          onGenerate={(fields) => printPonudaWithFields(ponudaModal.person, ponudaModal.type, fields, { closeModal: true })}
        />
      )}
    </div>
  );
}

function PersonModal({ form, setForm, editing, companies, onSave, onClose, onSaveAndPrint, onSaveAndPrintPonuda, saving, error }) {
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
              <CompanySearch
                companies={companies}
                selectedId={form.company_id}
                onSelect={(c) => u("company_id", c ? c.id : "")}
              />
            </div>
            <Field label="Ime *" value={form.ime} onChange={(v) => u("ime", v)} testid="person-ime" />
            <Field label="Prezime *" value={form.prezime} onChange={(v) => u("prezime", v)} testid="person-prezime" />
            
            <div className="field-group" style={{ gridColumn: "1/-1", padding: "10px 12px", background: form.is_stranac ? "#fef3c7" : "#f0fdf4", borderRadius: 8, border: `1px solid ${form.is_stranac ? "#fbbf24" : "#86efac"}` }}>
              <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 13.5, fontWeight: 500 }}>
                <input
                  type="checkbox"
                  checked={!!form.is_stranac}
                  onChange={(e) => u("is_stranac", e.target.checked)}
                  data-testid="person-is-stranac"
                  style={{ width: 18, height: 18 }}
                />
                {form.is_stranac ? "🌍 Strani državljanin" : "🇲🇪 Domaće lice (Crna Gora)"}
              </label>
              <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginTop: 6, marginLeft: 28 }}>
                {form.is_stranac 
                  ? "Za pisane ponude za boravak i rad — koristiće se broj pasoša ili lične karte." 
                  : "Standardno crnogorsko fizičko lice — koristiće se JMBG."}
              </div>
            </div>
            
            <Field label="JMBG" value={form.jmbg} onChange={(v) => u("jmbg", v)} testid="person-jmbg" />
            <Field label="Lična karta" value={form.licna_karta} onChange={(v) => u("licna_karta", v)} />
            {form.is_stranac && (
              <>
                <Field label="Broj pasoša" value={form.pasos} onChange={(v) => u("pasos", v)} testid="person-pasos" />
                <div className="field-group">
                  <label className="field-label">Vrsta isprave za pisanu ponudu</label>
                  <select
                    className="select"
                    value={form.vrsta_isprave || "pasos"}
                    onChange={(e) => u("vrsta_isprave", e.target.value)}
                    data-testid="person-vrsta-isprave"
                  >
                    <option value="pasos">Pasoš</option>
                    <option value="licna_karta">Lična karta</option>
                    <option value="jmbg">JMBG (jedinstveni matični)</option>
                  </select>
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>
                    Koji broj ide u rubriku JMBG/BROJ ISPRAVE u pisanoj ponudi.
                  </div>
                </div>
              </>
            )}
            
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
                {form.sati_sedmicno >= 40 ? "Puno radno vrijeme" : `Nepuno radno vrijeme — ${form.sati_sedmicno}h nedeljno`}
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
        <div className="modal-footer" style={{ flexWrap: "wrap" }}>
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
          {form.is_stranac && (
            <>
              <button
                className="btn btn-secondary"
                onClick={() => onSaveAndPrintPonuda("nova")}
                disabled={saving || !form.ime || !form.prezime || !form.company_id}
                data-testid="save-and-print-ponuda-nova-btn"
                title="Sačuvaj i generiši pisanu ponudu za novi boravak i rad"
                style={{ background: "#fef3c7", borderColor: "#fbbf24", color: "#92400e" }}
              >
                <Printer size={14} />
                Pisana ponuda (novi boravak)
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => onSaveAndPrintPonuda("produzenje")}
                disabled={saving || !form.ime || !form.prezime || !form.company_id}
                data-testid="save-and-print-ponuda-produzenje-btn"
                title="Sačuvaj i generiši pisanu ponudu za produženje dozvole"
                style={{ background: "#fef3c7", borderColor: "#fbbf24", color: "#92400e" }}
              >
                <Printer size={14} />
                Pisana ponuda (produženje)
              </button>
            </>
          )}
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

function CompanySearch({ companies, selectedId, onSelect }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  
  const selected = companies.find((c) => c.id === selectedId);
  
  const filtered = useMemo(() => {
    if (!query.trim()) return companies.slice(0, 50);
    const q = query.toLowerCase().trim();
    return companies.filter((c) =>
      (c.naziv || "").toLowerCase().includes(q) ||
      (c.naziv_skraceni || "").toLowerCase().includes(q) ||
      (c.pib || "").includes(q)
    ).slice(0, 50);
  }, [companies, query]);
  
  if (selected && !open) {
    return (
      <div
        className="input"
        style={{ cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px" }}
        onClick={() => setOpen(true)}
        data-testid="company-search-selected"
      >
        <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {selected.naziv}
          </div>
          <div style={{ fontSize: 11.5, color: "var(--text-tertiary)" }}>
            PIB: {selected.pib}
          </div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onSelect(null); setQuery(""); setOpen(true); }}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "var(--text-tertiary)" }}
          title="Promijeni firmu"
        >
          <X size={14} />
        </button>
      </div>
    );
  }
  
  return (
    <div style={{ position: "relative" }} data-testid="company-search">
      <div style={{ position: "relative" }}>
        <MagnifyingGlass size={14} style={{ position: "absolute", left: 10, top: 12, color: "var(--text-tertiary)" }} />
        <input
          className="input"
          placeholder="Kucaj naziv firme ili PIB..."
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          autoFocus
          style={{ paddingLeft: 32 }}
          data-testid="company-search-input"
        />
      </div>
      {open && (
        <div
          style={{
            position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
            background: "white", border: "1px solid var(--border)", borderRadius: 8,
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 100,
            maxHeight: 280, overflow: "auto"
          }}
        >
          {filtered.length === 0 && (
            <div style={{ padding: 14, textAlign: "center", color: "var(--text-tertiary)", fontSize: 13 }}>
              Nema firmi za "{query}"
            </div>
          )}
          {filtered.map((c) => (
            <div
              key={c.id}
              onMouseDown={(e) => { e.preventDefault(); onSelect(c); setOpen(false); setQuery(""); }}
              data-testid={`company-opt-${c.id}`}
              style={{
                padding: "9px 12px",
                cursor: "pointer",
                borderBottom: "1px solid var(--border-light)",
                display: "flex",
                flexDirection: "column",
                gap: 2,
                fontSize: 13,
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "#f8fafc"}
              onMouseLeave={(e) => e.currentTarget.style.background = "white"}
            >
              <div style={{ fontWeight: 500 }}>{c.naziv}</div>
              <div style={{ fontSize: 11.5, color: "var(--text-tertiary)" }}>
                {c.naziv_skraceni && <span>{c.naziv_skraceni} · </span>}
                PIB: {c.pib}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PonudaModal({ person, type, onClose, onGenerate }) {
  const today = new Date().toISOString().slice(0, 10);
  // Za "produženje" — default radni odnos od današnjeg datuma + 1 godina; za "nova" — isto
  const oneYearLater = new Date();
  oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
  oneYearLater.setDate(oneYearLater.getDate() - 1);
  const defaultDo = oneYearLater.toISOString().slice(0, 10);
  
  const [datumPonude, setDatumPonude] = useState(today);
  const [datumOd, setDatumOd] = useState(today);
  const [datumDo, setDatumDo] = useState(defaultDo);
  const [busy, setBusy] = useState(false);
  
  const submit = async () => {
    setBusy(true);
    await onGenerate({
      datum_ponude: datumPonude,
      datum_rad_od: datumOd,
      datum_rad_do: datumDo,
    });
    setBusy(false);
  };
  
  const title = type === "produzenje"
    ? "Pisana ponuda za PRODUŽENJE dozvole za boravak i rad"
    : "Pisana ponuda za NOVI boravak i rad";
  
  return (
    <div className="modal-backdrop" onClick={onClose} data-testid="ponuda-modal">
      <div className="modal animate-slide-up" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 540 }}>
        <div className="modal-header">
          <div>
            <div className="modal-title">{title}</div>
            <div style={{ fontSize: 12.5, color: "var(--text-tertiary)", marginTop: 2 }}>
              za: <strong>{person?.ime} {person?.prezime}</strong>
            </div>
          </div>
          <button onClick={onClose} style={{ border: "none", background: "transparent", padding: 6 }}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <div style={{ padding: "10px 12px", background: "#fef3c7", borderRadius: 8, marginBottom: 16, fontSize: 12.5, color: "#92400e", borderLeft: "3px solid #fbbf24" }}>
            💡 Broj zavedene ponude se <strong>automatski generiše</strong> po redu za ovu firmu (npr. <code>01/2026</code>, <code>02/2026</code>...). Iznos plate, ime, JMBG/pasoš i radno mjesto se uzimaju iz podataka zaposlenog.
          </div>
          
          <div className="field-group" style={{ marginBottom: 14 }}>
            <label className="field-label">Datum štampe ponude (gornji datum u dokumentu)</label>
            <input
              className="input" type="date"
              value={datumPonude}
              onChange={(e) => setDatumPonude(e.target.value)}
              data-testid="ponuda-datum-stampe"
            />
            <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>
              Standardno današnji — promijenite ako želite drugi datum.
            </div>
          </div>
          
          <div style={{ padding: 12, background: "#f8fafc", borderRadius: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Član 2 — Radni odnos na određeno vrijeme</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div className="field-group">
                <label className="field-label">Datum od (početak radnog odnosa)</label>
                <input
                  className="input" type="date"
                  value={datumOd}
                  onChange={(e) => setDatumOd(e.target.value)}
                  data-testid="ponuda-datum-od"
                />
              </div>
              <div className="field-group">
                <label className="field-label">Datum do (kraj)</label>
                <input
                  className="input" type="date"
                  value={datumDo}
                  onChange={(e) => setDatumDo(e.target.value)}
                  data-testid="ponuda-datum-do"
                />
              </div>
            </div>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 6 }}>
              Ostavite prazno ako klijent treba da popuni u Wordu — onda će biti crtice.
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Odustani</button>
          <button
            className="btn btn-primary"
            onClick={submit}
            disabled={busy}
            data-testid="ponuda-generate-btn"
          >
            {busy ? <Spinner size={14} className="spin" /> : <Printer size={14} />}
            Generiši i otvori
          </button>
        </div>
      </div>
    </div>
  );
}
