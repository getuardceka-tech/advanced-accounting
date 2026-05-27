import { useEffect, useMemo, useState } from "react";
import {
  ListChecks, Plus, MagnifyingGlass, X, Check, Spinner,
  Trash, Pencil, Calendar, Clock, ArrowsClockwise, CheckCircle, PaperPlaneTilt
} from "@phosphor-icons/react";
import api from "@/lib/api";

const KATEGORIJE = [
  { value: "osnivanje", label: "Osnivanje DOO", color: "#8b5cf6", icon: "🏢" },
  { value: "pdv", label: "PDV", color: "#3b82f6", icon: "📊" },
  { value: "ioppd", label: "IOPPD", color: "#10b981", icon: "📋" },
  { value: "m4", label: "M4", color: "#f59e0b", icon: "📑" },
  { value: "stvarni_vlasnici", label: "Stvarni vlasnici", color: "#ec4899", icon: "👥" },
  { value: "ostalo", label: "Ostalo", color: "#64748b", icon: "📌" },
];

const STATUSI = [
  { value: "u_toku", label: "U toku", color: "#f59e0b", icon: Clock },
  { value: "poslato", label: "Poslato", color: "#3b82f6", icon: PaperPlaneTilt },
  { value: "zavrseno", label: "Završeno", color: "#10b981", icon: CheckCircle },
];

const STATUS_BY = Object.fromEntries(STATUSI.map((s) => [s.value, s]));
const KAT_BY = Object.fromEntries(KATEGORIJE.map((k) => [k.value, k]));

export default function EvidencijaRada() {
  const [items, setItems] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterKategorija, setFilterKategorija] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterCompany, setFilterCompany] = useState("");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null);  // {entry} or null
  
  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterKategorija) params.kategorija = filterKategorija;
      if (filterStatus) params.status = filterStatus;
      if (filterCompany) params.company_id = filterCompany;
      if (search) params.q = search;
      const [logsR, compR] = await Promise.all([
        api.get("/work-logs", { params }),
        companies.length ? Promise.resolve({ data: companies }) : api.get("/companies?limit=200"),
      ]);
      setItems(logsR.data || []);
      if (!companies.length) setCompanies(compR.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKategorija, filterStatus, filterCompany, search]);
  
  const stats = useMemo(() => {
    const s = { total: items.length, u_toku: 0, poslato: 0, zavrseno: 0 };
    for (const it of items) s[it.status] = (s[it.status] || 0) + 1;
    return s;
  }, [items]);
  
  const updateStatus = async (id, newStatus) => {
    try {
      await api.patch(`/work-logs/${id}`, { status: newStatus });
      await load();
    } catch (e) {
      alert(`Greška: ${e.message}`);
    }
  };
  
  const remove = async (id) => {
    if (!confirm("Obrisati ovu stavku evidencije?")) return;
    await api.delete(`/work-logs/${id}`);
    await load();
  };
  
  return (
    <div data-testid="evidencija-rada-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Evidencija rada</h1>
          <p className="page-subtitle">
            Integrisani pregled svih radnih aktivnosti po firmama i kategorijama.
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setModal({ entry: { kategorija: "pdv", status: "u_toku", company_id: "", period: "", napomena: "" } })}
          data-testid="add-worklog-btn"
        >
          <Plus size={15} /> Dodaj evidenciju
        </button>
      </div>
      
      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
        <StatCard label="Ukupno" value={stats.total} color="#64748b" icon={ListChecks} />
        <StatCard label="U toku" value={stats.u_toku} color="#f59e0b" icon={Clock} />
        <StatCard label="Poslato" value={stats.poslato} color="#3b82f6" icon={PaperPlaneTilt} />
        <StatCard label="Završeno" value={stats.zavrseno} color="#10b981" icon={CheckCircle} />
      </div>
      
      {/* Filters */}
      <div style={{ background: "white", border: "1px solid var(--border)", borderRadius: 10, padding: 14, marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
            <MagnifyingGlass size={15} style={{ position: "absolute", left: 11, top: 11, color: "var(--text-tertiary)" }} />
            <input
              className="input"
              placeholder="Pretraži po firmi, napomeni ili periodu..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: 32 }}
              data-testid="worklog-search"
            />
          </div>
          <select className="select" value={filterCompany} onChange={(e) => setFilterCompany(e.target.value)} data-testid="worklog-filter-company" style={{ minWidth: 200 }}>
            <option value="">Sve firme</option>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.naziv}</option>)}
          </select>
          {(search || filterCompany || filterKategorija || filterStatus) && (
            <button className="btn btn-secondary" onClick={() => { setSearch(""); setFilterCompany(""); setFilterKategorija(""); setFilterStatus(""); }}>
              <X size={13} /> Resetuj
            </button>
          )}
        </div>
        
        {/* Kategorija tabs */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <FilterChip active={!filterKategorija} onClick={() => setFilterKategorija("")} label="Sve kategorije" />
          {KATEGORIJE.map((k) => (
            <FilterChip
              key={k.value}
              active={filterKategorija === k.value}
              onClick={() => setFilterKategorija(filterKategorija === k.value ? "" : k.value)}
              label={`${k.icon} ${k.label}`}
              color={k.color}
              testid={`filter-kat-${k.value}`}
            />
          ))}
        </div>
        
        {/* Status tabs */}
        <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
          <FilterChip active={!filterStatus} onClick={() => setFilterStatus("")} label="Svi statusi" />
          {STATUSI.map((s) => (
            <FilterChip
              key={s.value}
              active={filterStatus === s.value}
              onClick={() => setFilterStatus(filterStatus === s.value ? "" : s.value)}
              label={s.label}
              color={s.color}
              testid={`filter-status-${s.value}`}
            />
          ))}
        </div>
      </div>
      
      {/* Table */}
      <div style={{ background: "white", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
        {loading && <div style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)" }}><Spinner size={24} className="spin" /></div>}
        {!loading && items.length === 0 && (
          <div style={{ padding: 50, textAlign: "center", color: "var(--text-tertiary)" }}>
            <ListChecks size={42} style={{ marginBottom: 10, opacity: 0.4 }} />
            <div style={{ fontSize: 15, marginBottom: 4 }}>Nema evidencije za izabrane filtere</div>
            <div style={{ fontSize: 12.5 }}>Dodaj novu stavku ili promijeni filtere</div>
          </div>
        )}
        {!loading && items.length > 0 && (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
            <thead style={{ background: "#f8fafc", borderBottom: "1px solid var(--border)" }}>
              <tr>
                <th style={thStyle}>Kategorija</th>
                <th style={thStyle}>Firma</th>
                <th style={thStyle}>Period</th>
                <th style={thStyle}>Datum</th>
                <th style={thStyle}>Napomena</th>
                <th style={thStyle}>Status</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Akcije</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => {
                const k = KAT_BY[it.kategorija] || KAT_BY.ostalo;
                const s = STATUS_BY[it.status] || STATUS_BY.u_toku;
                const SIcon = s.icon;
                return (
                  <tr key={it.id} style={{ borderBottom: "1px solid var(--border-light)" }} data-testid={`worklog-row-${it.id}`}>
                    <td style={tdStyle}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 500, color: k.color, background: `${k.color}15`, padding: "3px 8px", borderRadius: 12 }}>
                        <span>{k.icon}</span> {k.label}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, fontWeight: 500 }}>{it.company_naziv || "—"}</td>
                    <td style={tdStyle}>{it.period || "—"}</td>
                    <td style={{ ...tdStyle, color: "var(--text-secondary)", fontSize: 12.5 }}>
                      {it.created_at ? new Date(it.created_at).toLocaleDateString("sr-Latn-ME") : "—"}
                    </td>
                    <td style={{ ...tdStyle, color: "var(--text-secondary)", fontSize: 12.5, maxWidth: 240 }}>
                      <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={it.napomena}>
                        {it.napomena || "—"}
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, fontWeight: 500, color: s.color, background: `${s.color}15`, padding: "3px 9px", borderRadius: 12 }}>
                        <SIcon size={12} weight="fill" /> {s.label}
                      </div>
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: 4 }}>
                        {it.status !== "zavrseno" && (
                          <button
                            className="btn btn-secondary"
                            onClick={() => updateStatus(it.id, it.status === "u_toku" ? "poslato" : "zavrseno")}
                            style={{ padding: "4px 8px", fontSize: 11.5 }}
                            data-testid={`advance-status-${it.id}`}
                            title={it.status === "u_toku" ? "Označi kao Poslato" : "Označi kao Završeno"}
                          >
                            <ArrowsClockwise size={11} /> {it.status === "u_toku" ? "Poslato" : "Završeno"}
                          </button>
                        )}
                        <button
                          className="btn btn-secondary"
                          onClick={() => setModal({ entry: it })}
                          style={{ padding: "4px 7px" }}
                          data-testid={`edit-${it.id}`}
                          title="Izmijeni"
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          className="btn btn-secondary"
                          onClick={() => remove(it.id)}
                          style={{ padding: "4px 7px", color: "var(--danger)" }}
                          data-testid={`delete-${it.id}`}
                          title="Obriši"
                        >
                          <Trash size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      
      {modal && (
        <WorkLogModal
          entry={modal.entry}
          companies={companies}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load(); }}
        />
      )}
    </div>
  );
}

const thStyle = { padding: "11px 14px", textAlign: "left", fontWeight: 600, fontSize: 11.5, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: 0.4 };
const tdStyle = { padding: "10px 14px" };

function StatCard({ label, value, color, icon: Icon }) {
  return (
    <div style={{ background: "white", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ width: 36, height: 36, borderRadius: 8, background: `${color}15`, color, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon size={18} weight="bold" />
      </div>
      <div>
        <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", fontWeight: 500, marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 20, fontWeight: 700 }}>{value}</div>
      </div>
    </div>
  );
}

function FilterChip({ active, onClick, label, color = "var(--accent)", testid }) {
  return (
    <button
      onClick={onClick}
      data-testid={testid}
      style={{
        padding: "6px 12px",
        borderRadius: 999,
        border: `1px solid ${active ? color : "var(--border)"}`,
        background: active ? `${color}15` : "white",
        color: active ? color : "var(--text-secondary)",
        cursor: "pointer",
        fontSize: 12.5,
        fontWeight: active ? 600 : 500,
        transition: "all 0.15s",
      }}
    >
      {label}
    </button>
  );
}

function WorkLogModal({ entry, companies, onClose, onSaved }) {
  const isNew = !entry.id;
  const [form, setForm] = useState({
    company_id: entry.company_id || "",
    company_naziv: entry.company_naziv || "",
    kategorija: entry.kategorija || "pdv",
    status: entry.status || "u_toku",
    period: entry.period || "",
    napomena: entry.napomena || "",
    iznos: entry.iznos ?? "",
  });
  const [busy, setBusy] = useState(false);
  
  const onCompanyChange = (cid) => {
    const c = companies.find((x) => x.id === cid);
    setForm({ ...form, company_id: cid, company_naziv: c ? c.naziv : "" });
  };
  
  const save = async () => {
    setBusy(true);
    try {
      const payload = { ...form, iznos: form.iznos === "" ? null : Number(form.iznos) };
      if (isNew) {
        await api.post("/work-logs", payload);
      } else {
        await api.patch(`/work-logs/${entry.id}`, payload);
      }
      onSaved();
    } catch (e) {
      alert(`Greška: ${e.response?.data?.detail || e.message}`);
    } finally {
      setBusy(false);
    }
  };
  
  return (
    <div className="modal-backdrop" onClick={onClose} data-testid="worklog-modal">
      <div className="modal animate-slide-up" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 540 }}>
        <div className="modal-header">
          <div className="modal-title">{isNew ? "Nova evidencija" : "Izmijeni evidenciju"}</div>
          <button onClick={onClose} style={{ border: "none", background: "transparent", padding: 6 }}><X size={18} /></button>
        </div>
        <div className="modal-body" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div className="field-group" style={{ gridColumn: "1/-1" }}>
            <label className="field-label">Kategorija *</label>
            <select className="select" value={form.kategorija} onChange={(e) => setForm({ ...form, kategorija: e.target.value })} data-testid="modal-kategorija">
              {KATEGORIJE.map((k) => <option key={k.value} value={k.value}>{k.icon} {k.label}</option>)}
            </select>
          </div>
          
          <div className="field-group" style={{ gridColumn: "1/-1" }}>
            <label className="field-label">Firma</label>
            <select className="select" value={form.company_id} onChange={(e) => onCompanyChange(e.target.value)} data-testid="modal-firma">
              <option value="">— Bez firme (za osnivanje nove firme) —</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.naziv}</option>)}
            </select>
          </div>
          
          {!form.company_id && (
            <div className="field-group" style={{ gridColumn: "1/-1" }}>
              <label className="field-label">Naziv firme (ručno — za firmu koja nije u bazi)</label>
              <input className="input" value={form.company_naziv} onChange={(e) => setForm({ ...form, company_naziv: e.target.value })} placeholder="DOO ..." />
            </div>
          )}
          
          <div className="field-group">
            <label className="field-label">Period (npr. Maj 2026)</label>
            <input className="input" value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} data-testid="modal-period" />
          </div>
          
          <div className="field-group">
            <label className="field-label">Status</label>
            <select className="select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} data-testid="modal-status">
              {STATUSI.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          
          <div className="field-group">
            <label className="field-label">Iznos (€) — opciono</label>
            <input className="input" type="number" value={form.iznos} onChange={(e) => setForm({ ...form, iznos: e.target.value })} />
          </div>
          
          <div className="field-group" style={{ gridColumn: "1/-1" }}>
            <label className="field-label">Napomena</label>
            <textarea className="input" value={form.napomena} onChange={(e) => setForm({ ...form, napomena: e.target.value })} rows={3} data-testid="modal-napomena" />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Odustani</button>
          <button className="btn btn-primary" onClick={save} disabled={busy} data-testid="modal-save">
            {busy ? <Spinner size={14} className="spin" /> : <Check size={14} />}
            Sačuvaj
          </button>
        </div>
      </div>
    </div>
  );
}
