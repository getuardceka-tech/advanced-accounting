import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  CaretLeft, Plus, PencilSimple, Trash, X, Check, Spinner, FileText,
  Users, Buildings, DownloadSimple, Printer,
} from "@phosphor-icons/react";
import api, { getToken, API } from "@/lib/api";

const empEmpty = {
  ime: "", prezime: "", jmbg: "", licna_karta: "", adresa: "", grad: "",
  pozicija: "", strucna_sprema: "", plata_bruto: 0, plata_neto: 0,
  datum_pocetka: "", datum_kraja: "", datum_prestanka: "",
  vrsta_ugovora: "neodredjeno", radno_vrijeme: "puno",
  telefon: "", email: "", aktivan: true,
};

export default function CompanyDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [company, setCompany] = useState(null);
  const [tab, setTab] = useState("podaci");
  const [employees, setEmployees] = useState([]);
  const [docs, setDocs] = useState([]);
  const [empModalOpen, setEmpModalOpen] = useState(false);
  const [empForm, setEmpForm] = useState(empEmpty);
  const [editingEmp, setEditingEmp] = useState(null);
  const [empSaving, setEmpSaving] = useState(false);
  const [empError, setEmpError] = useState("");

  const load = async () => {
    try {
      const [c, e, d] = await Promise.all([
        api.get(`/companies/${id}`),
        api.get(`/employees?company_id=${id}`),
        api.get(`/documents?company_id=${id}`),
      ]);
      setCompany(c.data);
      setEmployees(e.data);
      setDocs(d.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => { load(); }, [id]); // eslint-disable-line

  const openEmpCreate = () => {
    setEditingEmp(null);
    setEmpForm(empEmpty);
    setEmpError("");
    setEmpModalOpen(true);
  };

  const openEmpEdit = (emp) => {
    setEditingEmp(emp);
    setEmpForm({ ...empEmpty, ...emp });
    setEmpError("");
    setEmpModalOpen(true);
  };

  const saveEmp = async () => {
    if (!empForm.ime || !empForm.prezime) {
      setEmpError("Ime i prezime su obavezni");
      return;
    }
    setEmpSaving(true);
    try {
      const payload = { ...empForm, company_id: id, plata_bruto: Number(empForm.plata_bruto) || 0, plata_neto: Number(empForm.plata_neto) || 0 };
      if (editingEmp) {
        await api.put(`/employees/${editingEmp.id}`, payload);
      } else {
        await api.post(`/employees`, payload);
      }
      setEmpModalOpen(false);
      load();
    } catch (err) {
      setEmpError(err.response?.data?.detail || "Greška pri snimanju");
    } finally {
      setEmpSaving(false);
    }
  };

  const removeEmp = async (e) => {
    if (!window.confirm(`Obrisati zaposlenog ${e.ime} ${e.prezime}?`)) return;
    await api.delete(`/employees/${e.id}`);
    load();
  };

  if (!company) {
    return (
      <div className="empty">
        <Spinner size={28} className="spin" />
        <div className="empty-text" style={{ marginTop: 12 }}>Učitavam firmu...</div>
      </div>
    );
  }

  return (
    <div data-testid="company-detail-page">
      <button
        className="btn btn-ghost btn-sm"
        onClick={() => navigate("/firme")}
        style={{ marginBottom: 12 }}
        data-testid="back-to-companies"
      >
        <CaretLeft size={14} /> Sve firme
      </button>

      <div className="page-header" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 56, height: 56, borderRadius: 10, background: "#0f172a", color: "white",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "Cabinet Grotesk", fontSize: 22, fontWeight: 700,
            }}
          >
            {company.naziv?.[0]?.toUpperCase()}
          </div>
          <div>
            <h1 className="page-title" style={{ marginBottom: 6 }}>{company.naziv}</h1>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontSize: 12.5, color: "var(--text-tertiary)", fontFamily: "JetBrains Mono, monospace" }}>
                PIB {company.pib}
              </span>
              {company.pdv_obveznik && <span className="badge badge-blue">PDV obveznik</span>}
              {company.ioppd_obveznik && <span className="badge badge-neutral">IOPPD</span>}
              {!company.aktivna && <span className="badge badge-danger">Neaktivna</span>}
            </div>
          </div>
        </div>
      </div>

      <div className="tabs">
        {[
          { id: "podaci", label: "Podaci", icon: Buildings },
          { id: "objekti", label: "Objekti", icon: Buildings },
          { id: "zaposleni", label: `Zaposleni (${employees.length})`, icon: Users },
          { id: "dokumenti", label: `Dokumenti (${docs.length})`, icon: FileText },
        ].map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              className={`tab ${tab === t.id ? "active" : ""}`}
              onClick={() => setTab(t.id)}
              data-testid={`tab-${t.id}`}
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              <Icon size={14} /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === "podaci" && (
        <div className="card card-padded">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
            <InfoBlock title="Osnovni podaci" items={[
              ["Pun naziv", company.naziv],
              ["Skraćeni naziv", company.naziv_skraceni || "—"],
              ["PIB", company.pib],
              ["Matični broj", company.maticni_broj || "—"],
              ["PDV broj", company.pdv_broj || "—"],
              ["Djelatnost", company.djelatnost || "—"],
              ["Šifra djelatnosti", company.sifra_djelatnosti || "—"],
            ]} />
            <InfoBlock title="Registracijska adresa (sjedište)" items={[
              ["Adresa", company.adresa || "—"],
              ["Grad", company.grad || "—"],
              ["Telefon", company.telefon || "—"],
              ["Email", company.email || "—"],
            ]} />
            <InfoBlock title="Direktor" items={[
              ["Ime i prezime", company.direktor_ime || "—"],
              ["JMBG", company.direktor_jmbg || "—"],
              ["Adresa", company.direktor_adresa || "—"],
            ]} />
            <InfoBlock title="Bankovni podaci" items={[
              ["Žiro račun", company.ziro_racun || "—"],
              ["Banka", company.banka || "—"],
            ]} />
          </div>
          {company.napomena && (
            <div style={{ marginTop: 24, padding: 14, background: "#f8fafc", borderRadius: 8, fontSize: 13 }}>
              <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-tertiary)", fontWeight: 600, marginBottom: 6 }}>
                Napomena
              </div>
              {company.napomena}
            </div>
          )}
          <div style={{ marginTop: 20, padding: 12, background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, fontSize: 12.5, color: "#1e40af" }}>
            💡 <b>Sjedište</b> je registracijska adresa firme. Konkretna mjesta poslovanja (hoteli, restorani, prodavnice) dodaj kao zasebne <b>Objekte</b> u sljedećem tabu.
          </div>
        </div>
      )}

      {tab === "objekti" && (
        <ObjektiTab companyId={id} companyNaziv={company.naziv} />
      )}

      {tab === "zaposleni" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14, alignItems: "center" }}>
            <div style={{ fontSize: 13, color: "var(--text-tertiary)" }}>
              {employees.length} {employees.length === 1 ? "zaposleni" : "zaposlenih"}
            </div>
            <button className="btn btn-primary" onClick={openEmpCreate} data-testid="add-employee-btn">
              <Plus size={14} /> Dodaj zaposlenog
            </button>
          </div>

          {employees.length === 0 ? (
            <div className="empty">
              <div className="empty-icon"><Users size={24} /></div>
              <div className="empty-title">Nema unijetih zaposlenih</div>
              <div className="empty-text">Dodajte zaposlene da možete brže generisati ugovore i odluke.</div>
              <button className="btn btn-primary" onClick={openEmpCreate}>
                <Plus size={14} /> Dodaj prvog zaposlenog
              </button>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Ime i prezime</th>
                    <th>JMBG</th>
                    <th>Pozicija</th>
                    <th>Plata (€)</th>
                    <th>Ugovor</th>
                    <th style={{ width: 80 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((e) => (
                    <tr key={e.id} data-testid={`employee-row-${e.id}`}>
                      <td>
                        <div style={{ fontWeight: 500 }}>{e.ime} {e.prezime}</div>
                        {e.adresa && <div style={{ fontSize: 11.5, color: "var(--text-tertiary)" }}>{e.adresa}</div>}
                      </td>
                      <td style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 12.5 }}>{e.jmbg || "—"}</td>
                      <td style={{ fontSize: 12.5 }}>{e.pozicija || "—"}</td>
                      <td style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 12.5 }}>
                        {e.plata_bruto ? `${e.plata_bruto.toFixed(2)}` : "—"}
                      </td>
                      <td>
                        <span className="badge badge-neutral">{e.vrsta_ugovora === "neodredjeno" ? "Neodređeno" : "Određeno"}</span>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                          <button onClick={() => openEmpEdit(e)} style={{ border: "none", background: "transparent", padding: 5, borderRadius: 4, color: "var(--text-secondary)", cursor: "pointer", display: "flex" }}>
                            <PencilSimple size={15} />
                          </button>
                          <button onClick={() => removeEmp(e)} style={{ border: "none", background: "transparent", padding: 5, borderRadius: 4, color: "var(--danger-text)", cursor: "pointer", display: "flex" }}>
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
        </div>
      )}

      {tab === "dokumenti" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14, alignItems: "center" }}>
            <div style={{ fontSize: 13, color: "var(--text-tertiary)" }}>
              {docs.length} dokumenata generisano za ovu firmu
            </div>
            <button className="btn btn-primary" onClick={() => navigate(`/dokumenti?company=${id}`)} data-testid="generate-doc-btn">
              <FileText size={14} /> Generiši dokument
            </button>
          </div>

          {docs.length === 0 ? (
            <div className="empty">
              <div className="empty-icon"><FileText size={24} /></div>
              <div className="empty-title">Nema generisanih dokumenata</div>
              <div className="empty-text">Generišite ugovor, odluku, obavještenje ili neki drugi dokument za ovu firmu.</div>
              <button className="btn btn-primary" onClick={() => navigate(`/dokumenti?company=${id}`)}>
                <FileText size={14} /> Generiši dokument
              </button>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Dokument</th>
                    <th>Zaposleni</th>
                    <th>Datum</th>
                    <th style={{ width: 60 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {docs.map((d) => (
                    <tr key={d.id}>
                      <td>
                        <div style={{ fontWeight: 500, fontSize: 13 }}>{d.template?.replace(/\.[^.]+$/, "")}</div>
                      </td>
                      <td style={{ fontSize: 12.5 }}>{d.employee_naziv || "—"}</td>
                      <td style={{ fontSize: 12.5 }}>{new Date(d.created_at).toLocaleString("sr-Latn-ME")}</td>
                      <td>
                        <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                          {d.pdf_filename && (
                            <a
                              href={`${API}/documents/preview/${d.pdf_filename}?token=${getToken()}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: "var(--accent)", display: "flex", padding: 4 }}
                              title="Otvori PDF za štampu"
                            >
                              <Printer size={15} />
                            </a>
                          )}
                          <a
                            href={`${API}/documents/download/${d.filename}?token=${getToken()}`}
                            style={{ color: "var(--text-secondary)", display: "flex", padding: 4 }}
                            title="Preuzmi Word"
                          >
                            <DownloadSimple size={15} />
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {empModalOpen && (
        <EmployeeModal
          form={empForm}
          setForm={setEmpForm}
          editing={editingEmp}
          onSave={saveEmp}
          onClose={() => setEmpModalOpen(false)}
          saving={empSaving}
          error={empError}
        />
      )}
    </div>
  );
}

const InfoBlock = ({ title, items }) => (
  <div>
    <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-tertiary)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>
      {title}
    </div>
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {items.map(([k, v]) => (
        <div key={k} style={{ display: "grid", gridTemplateColumns: "140px 1fr", fontSize: 13 }}>
          <div style={{ color: "var(--text-tertiary)" }}>{k}</div>
          <div style={{ fontWeight: 500, wordBreak: "break-word" }}>{v}</div>
        </div>
      ))}
    </div>
  </div>
);

function EmployeeModal({ form, setForm, editing, onSave, onClose, saving, error }) {
  const u = (k, v) => setForm({ ...form, [k]: v });

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal animate-slide-up" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 720 }}>
        <div className="modal-header">
          <div className="modal-title">{editing ? "Uredi zaposlenog" : "Novi zaposleni"}</div>
          <button onClick={onClose} style={{ border: "none", background: "transparent", padding: 6 }}>
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">
          <div style={{ padding: "10px 12px", background: "#f8fafc", borderRadius: 8, marginBottom: 16, fontSize: 12.5, color: "var(--text-secondary)", borderLeft: "3px solid #2563eb" }}>
            💡 <strong>Pozicija (radno mjesto)</strong> se automatski povezuje sa ugovorima o radu, odlukama o pauzi, godišnjem odmoru i drugim dokumentima — popunite je da izbjegnete ručno unošenje.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Field label="Ime *" value={form.ime} onChange={(v) => u("ime", v)} testid="emp-ime" />
            <Field label="Prezime *" value={form.prezime} onChange={(v) => u("prezime", v)} testid="emp-prezime" />
            <Field label="JMBG" value={form.jmbg} onChange={(v) => u("jmbg", v)} testid="emp-jmbg" />
            <Field label="Lična karta" value={form.licna_karta} onChange={(v) => u("licna_karta", v)} testid="emp-licna" />
            <Field label="Adresa" value={form.adresa} onChange={(v) => u("adresa", v)} testid="emp-adresa" />
            <Field label="Grad" value={form.grad} onChange={(v) => u("grad", v)} testid="emp-grad" />
            <Field label="Pozicija — radno mjesto ⭐" value={form.pozicija} onChange={(v) => u("pozicija", v)} testid="emp-pozicija" />
            <Field label="Stručna sprema" value={form.strucna_sprema} onChange={(v) => u("strucna_sprema", v)} testid="emp-ss" />
            <Field label="Bruto plata (€)" value={form.plata_bruto} onChange={(v) => u("plata_bruto", v)} testid="emp-bruto" type="number" />
            <Field label="Neto plata (€)" value={form.plata_neto} onChange={(v) => u("plata_neto", v)} testid="emp-neto" type="number" />
            <Field label="Datum početka rada" value={form.datum_pocetka} onChange={(v) => u("datum_pocetka", v)} testid="emp-pocetak" type="date" />
            <div className="field-group">
              <label className="field-label">Vrsta ugovora</label>
              <select className="select" value={form.vrsta_ugovora} onChange={(e) => u("vrsta_ugovora", e.target.value)} data-testid="emp-vrsta">
                <option value="neodredjeno">Na neodređeno</option>
                <option value="odredjeno">Na određeno</option>
              </select>
            </div>
            {form.vrsta_ugovora === "odredjeno" && (
              <Field label="Datum kraja ugovora (određeno)" value={form.datum_kraja} onChange={(v) => u("datum_kraja", v)} testid="emp-datum-kraja" type="date" />
            )}
            <Field label="Datum prestanka rada (za odjavu)" value={form.datum_prestanka} onChange={(v) => u("datum_prestanka", v)} testid="emp-datum-prestanka" type="date" />
            <div className="field-group">
              <label className="field-label">Radno vrijeme</label>
              <select className="select" value={form.radno_vrijeme} onChange={(e) => u("radno_vrijeme", e.target.value)}>
                <option value="puno">Puno radno vrijeme</option>
                <option value="skraceno">Skraćeno</option>
              </select>
            </div>
            <Field label="Telefon" value={form.telefon} onChange={(v) => u("telefon", v)} testid="emp-tel" />
            <Field label="Email" value={form.email} onChange={(v) => u("email", v)} testid="emp-email" />
          </div>
          {error && <div style={{ marginTop: 14, padding: "10px 12px", background: "var(--danger-bg)", color: "var(--danger-text)", borderRadius: 6, fontSize: 13 }}>{error}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Odustani</button>
          <button className="btn btn-primary" onClick={onSave} disabled={saving} data-testid="save-employee-btn">
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

/* =================== OBJEKTI (poslovnice) =================== */
function ObjektiTab({ companyId, companyNaziv }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  
  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get(`/companies/${companyId}/objekti`);
      // Filtriraj samo sačuvane objekte za listu (saved=true)
      setItems((r.data || []).filter((o) => o.saved));
    } finally { setLoading(false); }
  };
  
  useEffect(() => { load(); }, [companyId]); // eslint-disable-line
  
  const removeObj = async (o) => {
    if (!confirm(`Obrisati objekat "${o.naziv_objekta}"?`)) return;
    try {
      await api.delete(`/companies/${companyId}/objekti/${o.id}`);
      await load();
    } catch (err) {
      alert("Greška: " + (err.response?.data?.detail || err.message));
    }
  };
  
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 13, color: "var(--text-tertiary)" }}>
          {items.length} {items.length === 1 ? "objekat" : items.length >= 2 && items.length <= 4 ? "objekta" : "objekata"} · npr. različite poslovnice, hoteli, restorani iste firme.
        </div>
        <button className="btn btn-primary" onClick={() => setModal({ entry: { naziv: "" } })} data-testid="add-objekat-btn">
          <Plus size={14} /> Novi objekat
        </button>
      </div>
      
      {loading ? <div style={{ padding: 40, textAlign: "center" }}><Spinner size={24} className="spin" /></div> : items.length === 0 ? (
        <div className="card card-padded" style={{ textAlign: "center", padding: 50, color: "var(--text-secondary)" }}>
          <Buildings size={36} weight="duotone" color="#94a3b8" style={{ marginBottom: 10 }} />
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Nema objekata</div>
          <div style={{ fontSize: 12.5, color: "var(--text-tertiary)" }}>
            Dodaj prvi objekat npr. <i>"{companyNaziv?.split(" ")[0] || "FIRMA"} 1"</i> sa zasebnom adresom.
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 12 }}>
          {items.map((o) => (
            <div key={o.id} className="card card-padded" style={{ position: "relative" }} data-testid={`objekat-card-${o.id}`}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", flex: 1 }}>{o.naziv_objekta}</div>
                <div style={{ display: "flex", gap: 4 }}>
                  <button className="btn btn-secondary" onClick={() => setModal({ entry: { id: o.id, naziv: o.naziv_objekta, adresa: o.adresa_objekta, grad: o.grad, telefon: o.telefon, sifra_djelatnosti: o.sifra_djelatnosti, napomena: o.napomena } })} style={{ padding: "4px 8px" }}>
                    <PencilSimple size={12} />
                  </button>
                  <button className="btn btn-secondary" onClick={() => removeObj(o)} style={{ padding: "4px 8px", color: "#ef4444" }}>
                    <Trash size={12} />
                  </button>
                </div>
              </div>
              <div style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                {o.adresa_objekta && <div>📍 {o.adresa_objekta}{o.grad ? `, ${o.grad}` : ""}</div>}
                {o.telefon && <div>📞 {o.telefon}</div>}
                {o.sifra_djelatnosti && <div>🏷️ Šifra: {o.sifra_djelatnosti}</div>}
                {o.napomena && <div style={{ marginTop: 6, padding: 6, background: "#f8fafc", borderRadius: 4, fontSize: 11.5, color: "var(--text-tertiary)" }}>{o.napomena}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
      
      {modal && <ObjektModal companyId={companyId} entry={modal.entry} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />}
    </div>
  );
}

function ObjektModal({ companyId, entry, onClose, onSaved }) {
  const isNew = !entry.id;
  const [form, setForm] = useState({
    naziv: entry.naziv || "",
    adresa: entry.adresa || "",
    grad: entry.grad || "",
    telefon: entry.telefon || "",
    sifra_djelatnosti: entry.sifra_djelatnosti || "",
    napomena: entry.napomena || "",
  });
  const [saving, setSaving] = useState(false);
  
  const save = async () => {
    if (!form.naziv.trim()) { alert("Naziv objekta je obavezan."); return; }
    setSaving(true);
    try {
      if (isNew) await api.post(`/companies/${companyId}/objekti`, form);
      else await api.put(`/companies/${companyId}/objekti/${entry.id}`, form);
      onSaved();
    } catch (err) {
      alert("Greška: " + (err.response?.data?.detail || err.message));
    } finally { setSaving(false); }
  };
  
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal animate-slide-up" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <div className="modal-header">
          <div className="modal-title">{isNew ? "Novi objekat" : "Izmijeni objekat"}</div>
          <button onClick={onClose} style={{ border: "none", background: "transparent", padding: 6 }}><X size={18} /></button>
        </div>
        <div className="modal-body" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Naziv objekta *" value={form.naziv} onChange={(v) => setForm({ ...form, naziv: v })} testid="obj-naziv" />
          <Field label="Telefon" value={form.telefon} onChange={(v) => setForm({ ...form, telefon: v })} testid="obj-telefon" />
          <div className="field-group" style={{ gridColumn: "1 / -1" }}>
            <label className="field-label">Adresa</label>
            <input className="input" value={form.adresa} onChange={(e) => setForm({ ...form, adresa: e.target.value })} placeholder="Npr. Bulevar Šahmanovića br. 5" data-testid="obj-adresa" />
          </div>
          <Field label="Grad" value={form.grad} onChange={(v) => setForm({ ...form, grad: v })} testid="obj-grad" />
          <Field label="Šifra djelatnosti" value={form.sifra_djelatnosti} onChange={(v) => setForm({ ...form, sifra_djelatnosti: v })} testid="obj-sd" />
          <div className="field-group" style={{ gridColumn: "1 / -1" }}>
            <label className="field-label">Napomena</label>
            <textarea className="input" rows={2} value={form.napomena} onChange={(e) => setForm({ ...form, napomena: e.target.value })} placeholder="Opciono - npr. tip objekta, kapacitet..." />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Odustani</button>
          <button className="btn btn-primary" onClick={save} disabled={saving} data-testid="obj-save-btn">
            {saving ? <Spinner size={14} className="spin" /> : <Check size={14} />} Sačuvaj
          </button>
        </div>
      </div>
    </div>
  );
}
