import { useEffect, useMemo, useState } from "react";
import {
  CurrencyEur, Plus, MagnifyingGlass, X, Check, Spinner,
  Trash, Pencil, Receipt, TrendUp, TrendDown,
  CheckCircle, Clock, Calendar, Briefcase, Wallet,
  Warning, DownloadSimple, FileXls, FilePdf,
} from "@phosphor-icons/react";
import api from "@/lib/api";

const MJESECI = ["Januar", "Februar", "Mart", "April", "Maj", "Jun", "Jul", "Avgust", "Septembar", "Oktobar", "Novembar", "Decembar"];

export default function Finansije() {
  const [tab, setTab] = useState("naknade");
  const [overdueCount, setOverdueCount] = useState(0);
  
  useEffect(() => {
    api.get("/finance/overdue").then((r) => setOverdueCount(r.data.length)).catch(() => {});
  }, [tab]);
  
  return (
    <div data-testid="finansije-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Finansije agencije</h1>
          <p className="page-subtitle">
            Cjenovnik, mjesečne naknade, dodatne usluge, troškovi i pregled profita.
          </p>
        </div>
      </div>
      
      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "white", padding: 5, borderRadius: 10, border: "1px solid var(--border)", width: "fit-content" }}>
        {[
          { v: "naknade", l: "💰 Mjesečne naknade" },
          { v: "alarmi", l: "⚠️ Alarmi", badge: overdueCount },
          { v: "usluge", l: "🛠️ Dodatne usluge" },
          { v: "troskovi", l: "📉 Troškovi" },
          { v: "pregled", l: "📊 Pregled profita" },
        ].map((t) => (
          <button
            key={t.v}
            onClick={() => setTab(t.v)}
            data-testid={`tab-${t.v}`}
            style={{
              padding: "8px 18px",
              borderRadius: 7,
              border: "none",
              background: tab === t.v ? "var(--accent)" : "transparent",
              color: tab === t.v ? "white" : "var(--text-secondary)",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: tab === t.v ? 600 : 500,
              transition: "all 0.15s",
              display: "flex", alignItems: "center", gap: 6,
            }}
          >
            {t.l}
            {t.badge > 0 && (
              <span style={{ background: tab === t.v ? "rgba(255,255,255,0.25)" : "#ef4444", color: "white", padding: "1px 7px", borderRadius: 10, fontSize: 11, fontWeight: 700 }}>
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>
      
      {tab === "naknade" && <MjesecneNaknade />}
      {tab === "alarmi" && <AlarmiNeplacenih onChanged={() => api.get("/finance/overdue").then((r) => setOverdueCount(r.data.length))} />}
      {tab === "usluge" && <DodatneUsluge />}
      {tab === "troskovi" && <Troskovi />}
      {tab === "pregled" && <PregledProfita />}
    </div>
  );
}

/* =================== MJESEČNE NAKNADE =================== */
function MjesecneNaknade() {
  const today = new Date();
  const [godina, setGodina] = useState(today.getFullYear());
  const [mjesec, setMjesec] = useState(today.getMonth() + 1);
  const [items, setItems] = useState([]);
  const [pricing, setPricing] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showPricing, setShowPricing] = useState(false);
  
  const load = async () => {
    setLoading(true);
    try {
      const [pr, pricR] = await Promise.all([
        api.get("/finance/payments", { params: { godina, mjesec } }),
        api.get("/finance/pricing"),
      ]);
      setItems(pr.data);
      setPricing(pricR.data);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [godina, mjesec]);
  
  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter((i) => (i.company_naziv || "").toLowerCase().includes(q));
  }, [items, search]);
  
  const updatePayment = async (item, patch) => {
    const payload = {
      company_id: item.company_id,
      godina, mjesec,
      iznos: Number(patch.iznos ?? item.iznos) || 0,
      is_paid: patch.is_paid !== undefined ? patch.is_paid : item.is_paid,
      datum_naplate: patch.datum_naplate !== undefined ? patch.datum_naplate : (item.datum_naplate || ""),
      napomena: patch.napomena !== undefined ? patch.napomena : (item.napomena || ""),
    };
    try {
      await api.post("/finance/payments", payload);
      await load();
    } catch (err) {
      const msg = err.response?.status === 502
        ? "Server trenutno nedostupan. Pokušaj ponovo za par sekundi."
        : `Greška pri čuvanju: ${err.message || "nepoznato"}`;
      // Soft notification — bez crash-a
      // eslint-disable-next-line no-console
      console.warn("[updatePayment]", err);
      window.dispatchEvent(new CustomEvent("toast", { detail: { type: "error", msg } }));
    }
  };
  
  const total = filtered.reduce((acc, i) => acc + (Number(i.iznos) || 0), 0);
  const paid = filtered.filter((i) => i.is_paid).reduce((acc, i) => acc + (Number(i.iznos) || 0), 0);
  const pending = total - paid;
  
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 14 }}>
        <StatCard label="Ukupno mjesečno" value={`${total.toFixed(2)} €`} color="#64748b" icon={CurrencyEur} />
        <StatCard label="Naplaćeno" value={`${paid.toFixed(2)} €`} color="#10b981" icon={CheckCircle} />
        <StatCard label="Čeka uplatu" value={`${pending.toFixed(2)} €`} color="#f59e0b" icon={Clock} />
      </div>
      
      <div style={{ background: "white", border: "1px solid var(--border)", borderRadius: 10, padding: 14, marginBottom: 14, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <select className="select" value={mjesec} onChange={(e) => setMjesec(Number(e.target.value))} data-testid="filter-mjesec" style={{ minWidth: 140 }}>
          {MJESECI.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <YearPicker value={godina} onChange={setGodina} width={100} />
        <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
          <MagnifyingGlass size={14} style={{ position: "absolute", left: 11, top: 11, color: "var(--text-tertiary)" }} />
          <input className="input" placeholder="Pretraži firmu..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ paddingLeft: 32 }} />
        </div>
        <button className="btn btn-secondary" onClick={() => setShowPricing(!showPricing)} data-testid="cjenovnik-btn">
          ⚙️ Cjenovnik firmi
        </button>
      </div>
      
      {showPricing && (
        <PricingPanel pricing={pricing} onClose={() => setShowPricing(false)} onSaved={load} />
      )}
      
      {loading ? <div style={{ padding: 40, textAlign: "center" }}><Spinner size={24} className="spin" /></div> : (
        <div style={{ background: "white", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead style={{ background: "#f8fafc", borderBottom: "1px solid var(--border)" }}>
              <tr>
                <th style={th}>Firma</th>
                <th style={{ ...th, width: 130 }}>Iznos (€)</th>
                <th style={{ ...th, width: 100 }}>Naplaćeno</th>
                <th style={{ ...th, width: 150 }}>Datum naplate</th>
                <th style={th}>Napomena</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((it) => {
                const now = new Date();
                const isPastMonth = (it.godina < now.getFullYear()) || (it.godina === now.getFullYear() && it.mjesec < now.getMonth() + 1);
                const isOverdue = !it.is_paid && isPastMonth && (Number(it.iznos) || 0) > 0;
                return (
                <tr key={it.company_id} style={{ borderBottom: "1px solid var(--border-light)", background: it.is_paid ? "#f0fdf4" : (isOverdue ? "#fef2f2" : "white") }} data-testid={`payment-row-${it.company_id}`}>
                  <td style={{ ...td, fontWeight: 500 }}>
                    {isOverdue && <Warning size={13} weight="fill" style={{ color: "#ef4444", marginRight: 6, verticalAlign: "middle" }} />}
                    {it.company_naziv}
                  </td>
                  <td style={td}>
                    <input
                      className="input"
                      type="number"
                      step="0.01"
                      value={it.iznos ?? 0}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setItems(items.map((x) => x.company_id === it.company_id ? { ...x, iznos: v } : x));
                      }}
                      onBlur={(e) => updatePayment(it, { iznos: e.target.value })}
                      style={{ padding: "5px 8px", fontSize: 13, height: 30 }}
                    />
                  </td>
                  <td style={{ ...td, textAlign: "center" }}>
                    <input
                      type="checkbox"
                      checked={it.is_paid || false}
                      onChange={(e) => updatePayment(it, { is_paid: e.target.checked, datum_naplate: e.target.checked && !it.datum_naplate ? new Date().toISOString().slice(0, 10) : it.datum_naplate })}
                      style={{ width: 18, height: 18, cursor: "pointer" }}
                      data-testid={`payment-paid-${it.company_id}`}
                    />
                  </td>
                  <td style={td}>
                    <input
                      className="input"
                      type="date"
                      value={it.datum_naplate || ""}
                      onChange={(e) => updatePayment(it, { datum_naplate: e.target.value })}
                      style={{ padding: "5px 8px", fontSize: 12.5, height: 30 }}
                      disabled={!it.is_paid}
                    />
                  </td>
                  <td style={td}>
                    <input
                      className="input"
                      placeholder="Napomena..."
                      value={it.napomena || ""}
                      onChange={(e) => setItems(items.map((x) => x.company_id === it.company_id ? { ...x, napomena: e.target.value } : x))}
                      onBlur={(e) => updatePayment(it, { napomena: e.target.value })}
                      style={{ padding: "5px 8px", fontSize: 12.5, height: 30 }}
                    />
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PricingPanel({ pricing, onClose, onSaved }) {
  const [rows, setRows] = useState(pricing);
  
  const save = async (cid, fee) => {
    await api.put(`/finance/pricing/${cid}`, { company_id: cid, monthly_fee: Number(fee) || 0 });
    onSaved();
  };
  
  return (
    <div style={{ background: "white", border: "1px solid var(--border)", borderRadius: 10, padding: 16, marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Standardni mjesečni cjenovnik po firmi</h3>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}><X size={16} /></button>
      </div>
      <div style={{ maxHeight: 350, overflow: "auto" }}>
        <table style={{ width: "100%", fontSize: 12.5 }}>
          <thead><tr style={{ background: "#f8fafc" }}>
            <th style={{ padding: 8, textAlign: "left" }}>Firma</th>
            <th style={{ padding: 8, textAlign: "left", width: 120 }}>Mjesečno (€)</th>
          </tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.company_id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                <td style={{ padding: 6 }}>{r.naziv}</td>
                <td style={{ padding: 6 }}>
                  <input
                    className="input"
                    type="number" step="0.01"
                    value={r.monthly_fee ?? 0}
                    onChange={(e) => setRows(rows.map((x) => x.company_id === r.company_id ? { ...x, monthly_fee: Number(e.target.value) } : x))}
                    onBlur={(e) => save(r.company_id, e.target.value)}
                    style={{ padding: "4px 8px", fontSize: 12.5, height: 28 }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* =================== DODATNE USLUGE =================== */
function DodatneUsluge() {
  const [items, setItems] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [godina, setGodina] = useState(new Date().getFullYear());
  const [modal, setModal] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const load = async () => {
    setLoading(true);
    const [s, c] = await Promise.all([
      api.get("/finance/services", { params: { godina } }),
      companies.length ? Promise.resolve({ data: companies }) : api.get("/companies"),
    ]);
    setItems(s.data);
    if (!companies.length) setCompanies(c.data);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [godina]);
  
  const remove = async (id) => {
    if (!confirm("Obrisati uslugu?")) return;
    await api.delete(`/finance/services/${id}`);
    load();
  };
  
  const total = items.reduce((a, i) => a + (Number(i.iznos) || 0), 0);
  const paid = items.filter((i) => i.is_paid).reduce((a, i) => a + (Number(i.iznos) || 0), 0);
  
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 14 }}>
        <StatCard label="Ukupno usluga" value={items.length} color="#64748b" icon={Briefcase} />
        <StatCard label="Naplaćeno" value={`${paid.toFixed(2)} €`} color="#10b981" icon={CheckCircle} />
        <StatCard label="Neisplaćeno" value={`${(total - paid).toFixed(2)} €`} color="#f59e0b" icon={Clock} />
      </div>
      <div style={{ marginBottom: 14, display: "flex", gap: 10, alignItems: "center" }}>
        <YearPicker value={godina} onChange={setGodina} width={100} />
        <button className="btn btn-primary" onClick={() => setModal({ entry: { datum: new Date().toISOString().slice(0, 10), is_paid: false } })} data-testid="add-service-btn">
          <Plus size={14} /> Dodaj uslugu
        </button>
      </div>
      
      {loading ? <div style={{ padding: 40, textAlign: "center" }}><Spinner size={24} className="spin" /></div> : (
        <div style={{ background: "white", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
          {items.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)", fontSize: 13 }}>
              Nema dodatnih usluga za {godina}. Dodaj prvu uslugu.
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead style={{ background: "#f8fafc" }}>
                <tr>
                  <th style={th}>Datum</th>
                  <th style={th}>Firma</th>
                  <th style={th}>Usluga</th>
                  <th style={{ ...th, textAlign: "right" }}>Iznos (€)</th>
                  <th style={th}>Status</th>
                  <th style={{ ...th, textAlign: "right" }}></th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                    <td style={{ ...td, fontSize: 12.5 }}>{new Date(it.datum).toLocaleDateString("sr-Latn-ME")}</td>
                    <td style={{ ...td, fontWeight: 500 }}>{it.company_naziv || "—"}</td>
                    <td style={td}>{it.naziv}</td>
                    <td style={{ ...td, textAlign: "right", fontWeight: 600 }}>{Number(it.iznos).toFixed(2)} €</td>
                    <td style={td}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: it.is_paid ? "#10b981" : "#f59e0b", background: it.is_paid ? "#d1fae5" : "#fef3c7", padding: "3px 8px", borderRadius: 10, fontWeight: 500 }}>
                        {it.is_paid ? "Naplaćeno" : "Čeka uplatu"}
                      </span>
                    </td>
                    <td style={{ ...td, textAlign: "right" }}>
                      <button className="btn btn-secondary" onClick={() => setModal({ entry: it })} style={{ padding: "4px 7px" }}><Pencil size={11} /></button>
                      <button className="btn btn-secondary" onClick={() => remove(it.id)} style={{ padding: "4px 7px", marginLeft: 4, color: "#ef4444" }}><Trash size={11} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
      
      {modal && <ServiceModal entry={modal.entry} companies={companies} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />}
    </div>
  );
}

function ServiceModal({ entry, companies, onClose, onSaved }) {
  const isNew = !entry.id;
  const [form, setForm] = useState({
    company_id: entry.company_id || "",
    naziv: entry.naziv || "",
    datum: entry.datum || new Date().toISOString().slice(0, 10),
    iznos: entry.iznos ?? 0,
    is_paid: entry.is_paid || false,
    datum_naplate: entry.datum_naplate || "",
    napomena: entry.napomena || "",
  });
  
  const save = async () => {
    const payload = { ...form, iznos: Number(form.iznos) || 0 };
    if (isNew) await api.post("/finance/services", payload);
    else await api.patch(`/finance/services/${entry.id}`, payload);
    onSaved();
  };
  
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal animate-slide-up" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
        <div className="modal-header">
          <div className="modal-title">{isNew ? "Nova dodatna usluga" : "Izmijeni uslugu"}</div>
          <button onClick={onClose} style={{ border: "none", background: "transparent", padding: 6 }}><X size={18} /></button>
        </div>
        <div className="modal-body" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className="field-group" style={{ gridColumn: "1/-1" }}>
            <label className="field-label">Firma *</label>
            <CompanySearch
              companies={companies}
              selectedId={form.company_id}
              onSelect={(c) => setForm({ ...form, company_id: c ? c.id : "" })}
            />
          </div>
          <div className="field-group" style={{ gridColumn: "1/-1" }}>
            <label className="field-label">Naziv usluge *</label>
            <input className="input" value={form.naziv} onChange={(e) => setForm({ ...form, naziv: e.target.value })} placeholder="Npr. Osnivanje DOO, Izvještaj banci..." />
          </div>
          <div className="field-group">
            <label className="field-label">Datum izvršenja</label>
            <input className="input" type="date" value={form.datum} onChange={(e) => setForm({ ...form, datum: e.target.value })} />
          </div>
          <div className="field-group">
            <label className="field-label">Iznos (€) *</label>
            <input className="input" type="number" step="0.01" value={form.iznos} onChange={(e) => setForm({ ...form, iznos: e.target.value })} />
          </div>
          <div className="field-group" style={{ gridColumn: "1/-1", padding: 10, background: "#f8fafc", borderRadius: 8 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 500 }}>
              <input type="checkbox" checked={form.is_paid} onChange={(e) => setForm({ ...form, is_paid: e.target.checked, datum_naplate: e.target.checked && !form.datum_naplate ? new Date().toISOString().slice(0, 10) : form.datum_naplate })} style={{ width: 16, height: 16 }} />
              Naplaćeno
            </label>
            {form.is_paid && (
              <input className="input" type="date" value={form.datum_naplate} onChange={(e) => setForm({ ...form, datum_naplate: e.target.value })} style={{ marginTop: 8 }} />
            )}
          </div>
          <div className="field-group" style={{ gridColumn: "1/-1" }}>
            <label className="field-label">Napomena</label>
            <textarea className="input" value={form.napomena} onChange={(e) => setForm({ ...form, napomena: e.target.value })} rows={2} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Odustani</button>
          <button className="btn btn-primary" onClick={save}><Check size={14} /> Sačuvaj</button>
        </div>
      </div>
    </div>
  );
}

/* =================== TROŠKOVI =================== */
function Troskovi() {
  const [items, setItems] = useState([]);
  const [services, setServices] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [godina, setGodina] = useState(new Date().getFullYear());
  const [filterKat, setFilterKat] = useState("");
  const [modal, setModal] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const load = async () => {
    setLoading(true);
    const [e, s, c] = await Promise.all([
      api.get("/finance/expenses", { params: { godina, ...(filterKat ? { kategorija: filterKat } : {}) } }),
      services.length ? Promise.resolve({ data: services }) : api.get("/finance/services"),
      companies.length ? Promise.resolve({ data: companies }) : api.get("/companies"),
    ]);
    setItems(e.data);
    if (!services.length) setServices(s.data);
    if (!companies.length) setCompanies(c.data);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [godina, filterKat]);
  
  const remove = async (id) => {
    if (!confirm("Obrisati trošak?")) return;
    await api.delete(`/finance/expenses/${id}`);
    load();
  };
  
  const totalOpsti = items.filter((i) => i.kategorija === "opsti").reduce((a, i) => a + (Number(i.iznos) || 0), 0);
  const totalUsluga = items.filter((i) => i.kategorija === "usluga").reduce((a, i) => a + (Number(i.iznos) || 0), 0);
  
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 14 }}>
        <StatCard label="Opšti troškovi" value={`${totalOpsti.toFixed(2)} €`} color="#3b82f6" icon={Receipt} />
        <StatCard label="Troškovi za usluge" value={`${totalUsluga.toFixed(2)} €`} color="#8b5cf6" icon={Briefcase} />
        <StatCard label="Ukupno troškova" value={`${(totalOpsti + totalUsluga).toFixed(2)} €`} color="#ef4444" icon={TrendDown} />
      </div>
      <div style={{ marginBottom: 14, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <YearPicker value={godina} onChange={setGodina} width={100} />
        <select className="select" value={filterKat} onChange={(e) => setFilterKat(e.target.value)} style={{ width: 180 }}>
          <option value="">Sve kategorije</option>
          <option value="opsti">Opšti agencijski</option>
          <option value="usluga">Vezan za uslugu</option>
        </select>
        <button className="btn btn-primary" onClick={() => setModal({ entry: { datum: new Date().toISOString().slice(0, 10), kategorija: "opsti" } })} data-testid="add-expense-btn">
          <Plus size={14} /> Dodaj trošak
        </button>
      </div>
      
      {loading ? <div style={{ padding: 40, textAlign: "center" }}><Spinner size={24} className="spin" /></div> : (
        <div style={{ background: "white", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
          {items.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)", fontSize: 13 }}>
              Nema troškova za {godina}. Dodaj prvi trošak.
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead style={{ background: "#f8fafc" }}>
                <tr>
                  <th style={th}>Datum</th>
                  <th style={th}>Naziv</th>
                  <th style={th}>Kategorija</th>
                  <th style={{ ...th, textAlign: "right" }}>Iznos (€)</th>
                  <th style={th}>Napomena</th>
                  <th style={{ ...th, textAlign: "right" }}></th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                    <td style={{ ...td, fontSize: 12.5 }}>{new Date(it.datum).toLocaleDateString("sr-Latn-ME")}</td>
                    <td style={{ ...td, fontWeight: 500 }}>{it.naziv}</td>
                    <td style={td}>
                      <span style={{ fontSize: 11.5, padding: "3px 8px", borderRadius: 10, fontWeight: 500, background: it.kategorija === "opsti" ? "#dbeafe" : "#f3e8ff", color: it.kategorija === "opsti" ? "#1e40af" : "#7c3aed" }}>
                        {it.kategorija === "opsti" ? "Opšti" : "Usluga"}
                      </span>
                    </td>
                    <td style={{ ...td, textAlign: "right", fontWeight: 600, color: "#ef4444" }}>-{Number(it.iznos).toFixed(2)} €</td>
                    <td style={{ ...td, color: "var(--text-secondary)", fontSize: 12.5 }}>{it.napomena || "—"}</td>
                    <td style={{ ...td, textAlign: "right" }}>
                      <button className="btn btn-secondary" onClick={() => setModal({ entry: it })} style={{ padding: "4px 7px" }}><Pencil size={11} /></button>
                      <button className="btn btn-secondary" onClick={() => remove(it.id)} style={{ padding: "4px 7px", marginLeft: 4, color: "#ef4444" }}><Trash size={11} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
      
      {modal && <ExpenseModal entry={modal.entry} services={services} companies={companies} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />}
    </div>
  );
}

function ExpenseModal({ entry, services, companies, onClose, onSaved }) {
  const isNew = !entry.id;
  const [form, setForm] = useState({
    naziv: entry.naziv || "",
    datum: entry.datum || new Date().toISOString().slice(0, 10),
    iznos: entry.iznos ?? 0,
    kategorija: entry.kategorija || "opsti",
    extra_service_id: entry.extra_service_id || "",
    company_id: entry.company_id || "",
    napomena: entry.napomena || "",
  });
  
  const save = async () => {
    if (!form.naziv) { alert("Naziv troška je obavezan"); return; }
    const payload = { ...form, iznos: Number(form.iznos) || 0 };
    if (isNew) await api.post("/finance/expenses", payload);
    else await api.patch(`/finance/expenses/${entry.id}`, payload);
    onSaved();
  };
  
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal animate-slide-up" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 540 }}>
        <div className="modal-header">
          <div className="modal-title">{isNew ? "Novi trošak" : "Izmijeni trošak"}</div>
          <button onClick={onClose} style={{ border: "none", background: "transparent", padding: 6 }}><X size={18} /></button>
        </div>
        <div className="modal-body" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className="field-group" style={{ gridColumn: "1/-1" }}>
            <label className="field-label">Naziv troška *</label>
            <input className="input" value={form.naziv} onChange={(e) => setForm({ ...form, naziv: e.target.value })} placeholder="Npr. Kancelarija, Office 365..." autoFocus />
          </div>
          <div className="field-group">
            <label className="field-label">Datum</label>
            <input className="input" type="date" value={form.datum} onChange={(e) => setForm({ ...form, datum: e.target.value })} />
          </div>
          <div className="field-group">
            <label className="field-label">Iznos (€) *</label>
            <input className="input" type="number" step="0.01" value={form.iznos} onChange={(e) => setForm({ ...form, iznos: e.target.value })} />
          </div>
          <div className="field-group" style={{ gridColumn: "1/-1" }}>
            <label className="field-label">Kategorija</label>
            <div style={{ display: "flex", gap: 6 }}>
              {[
                { v: "opsti", l: "Opšti agencijski trošak", color: "#3b82f6" },
                { v: "usluga", l: "Vezan za konkretnu uslugu", color: "#8b5cf6" },
              ].map((k) => (
                <button
                  key={k.v}
                  onClick={() => setForm({ ...form, kategorija: k.v })}
                  style={{
                    flex: 1, padding: 10, borderRadius: 8,
                    border: `1px solid ${form.kategorija === k.v ? k.color : "var(--border)"}`,
                    background: form.kategorija === k.v ? `${k.color}15` : "white",
                    color: form.kategorija === k.v ? k.color : "var(--text-secondary)",
                    cursor: "pointer", fontSize: 12.5,
                    fontWeight: form.kategorija === k.v ? 600 : 500,
                  }}
                >
                  {k.l}
                </button>
              ))}
            </div>
          </div>
          {form.kategorija === "usluga" && (
            <>
              <div className="field-group" style={{ gridColumn: "1/-1" }}>
                <label className="field-label">Firma za koju radim uslugu</label>
                <CompanySearch
                  companies={companies}
                  selectedId={form.company_id}
                  onSelect={(c) => setForm({ ...form, company_id: c ? c.id : "" })}
                />
              </div>
              <div className="field-group" style={{ gridColumn: "1/-1" }}>
                <label className="field-label">Povezana usluga (opciono)</label>
                <select className="select" value={form.extra_service_id} onChange={(e) => setForm({ ...form, extra_service_id: e.target.value })}>
                  <option value="">— Odaberi uslugu —</option>
                  {services.map((s) => <option key={s.id} value={s.id}>{s.naziv} ({s.company_naziv || ""})</option>)}
                </select>
              </div>
            </>
          )}
          <div className="field-group" style={{ gridColumn: "1/-1" }}>
            <label className="field-label">Napomena</label>
            <textarea className="input" value={form.napomena} onChange={(e) => setForm({ ...form, napomena: e.target.value })} rows={2} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Odustani</button>
          <button className="btn btn-primary" onClick={save}><Check size={14} /> Sačuvaj</button>
        </div>
      </div>
    </div>
  );
}

/* =================== PREGLED PROFITA =================== */
function PregledProfita() {
  const [summary, setSummary] = useState(null);
  const [perClient, setPerClient] = useState([]);
  const [godina, setGodina] = useState(new Date().getFullYear());
  const [exporting, setExporting] = useState("");
  const [clientSort, setClientSort] = useState("profit"); // profit | naziv | income | expense
  const [clientSearch, setClientSearch] = useState("");
  
  useEffect(() => {
    api.get("/finance/summary", { params: { godina } }).then((r) => setSummary(r.data));
    api.get("/finance/per-client", { params: { godina } }).then((r) => setPerClient(r.data));
  }, [godina]);
  
  const downloadExport = async (kind) => {
    setExporting(kind);
    try {
      const res = await api.get(`/finance/export/${kind}`, { params: { godina }, responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.download = kind === "excel" ? `Finansije_${godina}.xlsx` : `Finansijski_izvjestaj_${godina}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert("Greška pri exportu: " + (err.response?.data?.detail || err.message));
    } finally { setExporting(""); }
  };
  
  if (!summary) return <div style={{ padding: 40, textAlign: "center" }}><Spinner size={24} className="spin" /></div>;
  
  return (
    <div>
      <div style={{ marginBottom: 14, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <YearPicker value={godina} onChange={setGodina} width={100} />
        <span style={{ fontSize: 13, color: "var(--text-tertiary)" }}>Pregled za {godina}. godinu</span>
        <div style={{ flex: 1 }} />
        <button className="btn btn-secondary" onClick={() => downloadExport("excel")} disabled={exporting === "excel"} data-testid="export-excel-btn">
          {exporting === "excel" ? <Spinner size={14} className="spin" /> : <FileXls size={15} />} Excel
        </button>
        <button className="btn btn-secondary" onClick={() => downloadExport("pdf")} disabled={exporting === "pdf"} data-testid="export-pdf-btn">
          {exporting === "pdf" ? <Spinner size={14} className="spin" /> : <FilePdf size={15} />} PDF
        </button>
      </div>
      
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
        <BigStat label="📥 Naplaćeni mjesečni" value={`${summary.income_monthly_paid.toFixed(2)} €`} color="#10b981" sub={`Čeka: ${summary.income_monthly_pending.toFixed(2)} €`} />
        <BigStat label="🛠️ Naplaćene extra usluge" value={`${summary.income_extra_paid.toFixed(2)} €`} color="#3b82f6" sub={`Čeka: ${summary.income_extra_pending.toFixed(2)} €`} />
        <BigStat label="📉 Ukupni troškovi" value={`-${summary.total_expense.toFixed(2)} €`} color="#ef4444" sub={`Opšti: ${summary.expense_opsti.toFixed(2)} € · Usluga: ${summary.expense_usluga.toFixed(2)} €`} />
        <BigStat label="💎 ČISTI PROFIT" value={`${summary.profit_net.toFixed(2)} €`} color={summary.profit_net >= 0 ? "#10b981" : "#ef4444"} big />
      </div>
      
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
        <div style={{ background: "white", border: "1px solid var(--border)", borderRadius: 10, padding: 16 }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 600 }}>📊 Profit od mjesečnih usluga</h3>
          <div style={{ fontSize: 12.5, color: "var(--text-secondary)", marginBottom: 8 }}>Prihod naplaćen − opšti troškovi</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: summary.profit_monthly_services >= 0 ? "#10b981" : "#ef4444" }}>
            {summary.profit_monthly_services.toFixed(2)} €
          </div>
        </div>
        <div style={{ background: "white", border: "1px solid var(--border)", borderRadius: 10, padding: 16 }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 600 }}>🛠️ Profit od extra usluga</h3>
          <div style={{ fontSize: 12.5, color: "var(--text-secondary)", marginBottom: 8 }}>Naplaćeno za usluge − troškovi za usluge</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: summary.profit_extra_services >= 0 ? "#10b981" : "#ef4444" }}>
            {summary.profit_extra_services.toFixed(2)} €
          </div>
        </div>
      </div>
      
      <div style={{ background: "white", border: "1px solid var(--border)", borderRadius: 10, padding: 16 }}>
        <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 600 }}>📅 Mjesečni breakdown {godina}</h3>
        <table style={{ width: "100%", fontSize: 12.5 }}>
          <thead><tr style={{ background: "#f8fafc" }}>
            <th style={{ padding: 8, textAlign: "left" }}>Mjesec</th>
            <th style={{ padding: 8, textAlign: "right" }}>Mjesečne (€)</th>
            <th style={{ padding: 8, textAlign: "right" }}>Extra (€)</th>
            <th style={{ padding: 8, textAlign: "right" }}>Troškovi (€)</th>
            <th style={{ padding: 8, textAlign: "right", fontWeight: 700 }}>Profit (€)</th>
          </tr></thead>
          <tbody>
            {MJESECI.map((m, i) => {
              const data = summary.monthly_breakdown[i + 1] || {};
              const profit = (data.income_monthly || 0) + (data.income_extra || 0) - (data.expense || 0);
              return (
                <tr key={i} style={{ borderBottom: "1px solid var(--border-light)" }}>
                  <td style={{ padding: 7 }}>{m}</td>
                  <td style={{ padding: 7, textAlign: "right", color: "#10b981" }}>{(data.income_monthly || 0).toFixed(2)}</td>
                  <td style={{ padding: 7, textAlign: "right", color: "#3b82f6" }}>{(data.income_extra || 0).toFixed(2)}</td>
                  <td style={{ padding: 7, textAlign: "right", color: "#ef4444" }}>-{(data.expense || 0).toFixed(2)}</td>
                  <td style={{ padding: 7, textAlign: "right", fontWeight: 600, color: profit >= 0 ? "#10b981" : "#ef4444" }}>{profit.toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      <PerClientReport perClient={perClient} clientSort={clientSort} setClientSort={setClientSort} clientSearch={clientSearch} setClientSearch={setClientSearch} godina={godina} />
    </div>
  );
}

function PerClientReport({ perClient, clientSort, setClientSort, clientSearch, setClientSearch, godina }) {
  const filtered = useMemo(() => {
    let arr = perClient;
    if (clientSearch.trim()) {
      const q = clientSearch.toLowerCase();
      arr = arr.filter((c) => (c.naziv || "").toLowerCase().includes(q) || (c.pib || "").includes(q));
    }
    const sorted = [...arr];
    if (clientSort === "naziv") sorted.sort((a, b) => (a.naziv || "").localeCompare(b.naziv || ""));
    else if (clientSort === "income") sorted.sort((a, b) => b.total_income_paid - a.total_income_paid);
    else if (clientSort === "expense") sorted.sort((a, b) => b.expense_direct - a.expense_direct);
    else if (clientSort === "pending") sorted.sort((a, b) => b.total_pending - a.total_pending);
    else sorted.sort((a, b) => b.profit - a.profit);
    return sorted;
  }, [perClient, clientSort, clientSearch]);
  
  const tot = perClient.reduce((acc, c) => ({
    income: acc.income + c.total_income_paid,
    expense: acc.expense + c.expense_direct,
    profit: acc.profit + c.profit,
    pending: acc.pending + c.total_pending,
  }), { income: 0, expense: 0, profit: 0, pending: 0 });
  
  return (
    <div style={{ background: "white", border: "1px solid var(--border)", borderRadius: 10, padding: 16, marginTop: 16 }} data-testid="per-client-report">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>👥 Profit po klijentu — {godina}</h3>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ position: "relative" }}>
            <MagnifyingGlass size={13} style={{ position: "absolute", left: 9, top: 10, color: "var(--text-tertiary)" }} />
            <input className="input" placeholder="Pretraži firmu..." value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} style={{ paddingLeft: 28, height: 32, fontSize: 12.5, width: 200 }} />
          </div>
          <select className="select" value={clientSort} onChange={(e) => setClientSort(e.target.value)} style={{ width: 180, height: 32, fontSize: 12.5 }} data-testid="client-sort">
            <option value="profit">Sortiraj: Profit ↓</option>
            <option value="income">Sortiraj: Prihod ↓</option>
            <option value="expense">Sortiraj: Troškovi ↓</option>
            <option value="pending">Sortiraj: Duguje ↓</option>
            <option value="naziv">Sortiraj: Naziv A-Z</option>
          </select>
        </div>
      </div>
      
      <div style={{ overflow: "auto", maxHeight: 560 }}>
        <table style={{ width: "100%", fontSize: 12.5, borderCollapse: "collapse" }}>
          <thead style={{ background: "#f8fafc", position: "sticky", top: 0 }}>
            <tr>
              <th style={{ padding: 8, textAlign: "left", fontWeight: 600 }}>Klijent</th>
              <th style={{ padding: 8, textAlign: "right", fontWeight: 600 }}>Mjes. naplaćeno</th>
              <th style={{ padding: 8, textAlign: "right", fontWeight: 600 }}>Extra naplaćeno</th>
              <th style={{ padding: 8, textAlign: "right", fontWeight: 600 }}>Duguje</th>
              <th style={{ padding: 8, textAlign: "right", fontWeight: 600 }}>Direktni troškovi</th>
              <th style={{ padding: 8, textAlign: "right", fontWeight: 700 }}>PROFIT</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={6} style={{ padding: 24, textAlign: "center", color: "var(--text-tertiary)" }}>Nema podataka za prikaz.</td></tr>
            )}
            {filtered.map((c) => (
              <tr key={c.company_id} style={{ borderBottom: "1px solid var(--border-light)" }} data-testid={`pc-row-${c.company_id}`}>
                <td style={{ padding: 8 }}>
                  <div style={{ fontWeight: 600 }}>{c.naziv}</div>
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                    {c.pib && <>PIB: {c.pib} · </>}
                    {c.n_paid_months > 0 && <>{c.n_paid_months} mj. naplaćeno · </>}
                    {c.n_extra_services > 0 && <>{c.n_extra_services} extra usluga</>}
                  </div>
                </td>
                <td style={{ padding: 8, textAlign: "right", color: "#10b981", fontWeight: 500 }}>{c.income_monthly_paid.toFixed(2)} €</td>
                <td style={{ padding: 8, textAlign: "right", color: "#3b82f6", fontWeight: 500 }}>{c.income_extra_paid.toFixed(2)} €</td>
                <td style={{ padding: 8, textAlign: "right", color: c.total_pending > 0 ? "#f59e0b" : "var(--text-tertiary)", fontWeight: c.total_pending > 0 ? 600 : 400 }}>
                  {c.total_pending > 0 ? `${c.total_pending.toFixed(2)} €` : "—"}
                </td>
                <td style={{ padding: 8, textAlign: "right", color: "#ef4444" }}>
                  {c.expense_direct > 0 ? `-${c.expense_direct.toFixed(2)} €` : "—"}
                </td>
                <td style={{ padding: 8, textAlign: "right", fontWeight: 700, color: c.profit >= 0 ? "#10b981" : "#ef4444", fontSize: 13 }}>
                  {c.profit.toFixed(2)} €
                </td>
              </tr>
            ))}
          </tbody>
          {filtered.length > 0 && (
            <tfoot style={{ background: "#f8fafc", borderTop: "2px solid var(--border)" }}>
              <tr>
                <td style={{ padding: 10, fontWeight: 700 }}>UKUPNO ({filtered.length} klijenata)</td>
                <td colSpan={2} style={{ padding: 10, textAlign: "right", fontWeight: 700, color: "#10b981" }}>{tot.income.toFixed(2)} €</td>
                <td style={{ padding: 10, textAlign: "right", fontWeight: 700, color: "#f59e0b" }}>{tot.pending.toFixed(2)} €</td>
                <td style={{ padding: 10, textAlign: "right", fontWeight: 700, color: "#ef4444" }}>-{tot.expense.toFixed(2)} €</td>
                <td style={{ padding: 10, textAlign: "right", fontWeight: 700, color: tot.profit >= 0 ? "#10b981" : "#ef4444", fontSize: 14 }}>{tot.profit.toFixed(2)} €</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <div style={{ marginTop: 10, fontSize: 11.5, color: "var(--text-tertiary)" }}>
        💡 <i>Direktni troškovi</i> uključuju samo troškove kategorije "Vezan za uslugu" povezane sa klijentom. Opšti agencijski troškovi nisu raspoređeni po klijentima.
      </div>
    </div>
  );
}

/* =================== HELPERS =================== */
const th = { padding: "10px 12px", textAlign: "left", fontWeight: 600, fontSize: 11.5, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: 0.4 };
const td = { padding: "9px 12px" };

function YearPicker({ value, onChange, width = 140 }) {
  const [years, setYears] = useState([new Date().getFullYear(), new Date().getFullYear() + 1]);
  const [loaded, setLoaded] = useState(false);
  
  useEffect(() => {
    api.get("/finance/settings").then((r) => {
      const ys = r.data.active_years || [];
      if (ys.length) setYears(ys);
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);
  
  const addYear = async () => {
    const input = prompt("Unesi godinu koju želiš dodati (npr. 2028):", String(Math.max(...years) + 1));
    if (!input) return;
    const yr = parseInt(input, 10);
    if (isNaN(yr) || yr < 2020 || yr > 2099) { alert("Neispravna godina."); return; }
    if (years.includes(yr)) { alert("Godina već postoji."); return; }
    const newYears = [...years, yr].sort();
    setYears(newYears);
    await api.put("/finance/settings", { active_years: newYears });
    if (onChange) onChange(yr);
  };
  
  const removeYear = async (yr) => {
    if (years.length <= 1) { alert("Mora ostati barem jedna godina."); return; }
    if (!confirm(`Ukloniti godinu ${yr} iz liste? (Postojeći podaci u bazi neće biti obrisani.)`)) return;
    const newYears = years.filter((y) => y !== yr);
    setYears(newYears);
    await api.put("/finance/settings", { active_years: newYears });
    if (yr === value && newYears.length) onChange(newYears[0]);
  };
  
  return (
    <div style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
      <select className="select" value={value} onChange={(e) => onChange(Number(e.target.value))} style={{ width }} data-testid="year-picker">
        {!years.includes(value) && <option value={value}>{value}</option>}
        {years.map((g) => <option key={g} value={g}>{g}</option>)}
      </select>
      <button
        type="button"
        onClick={addYear}
        title="Dodaj novu godinu"
        data-testid="add-year-btn"
        style={{ padding: "6px 9px", borderRadius: 6, border: "1px solid var(--border)", background: "white", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--text-secondary)" }}
      >
        <Plus size={12} /> Godina
      </button>
      {loaded && years.length > 1 && years.includes(value) && (
        <button
          type="button"
          onClick={() => removeYear(value)}
          title={`Ukloni ${value} iz liste`}
          data-testid="remove-year-btn"
          style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "white", cursor: "pointer", color: "#ef4444", display: "inline-flex", alignItems: "center" }}
        >
          <Trash size={12} />
        </button>
      )}
    </div>
  );
}

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
        data-testid="finance-company-selected"
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
    <div style={{ position: "relative" }} data-testid="finance-company-search">
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
          data-testid="finance-company-search-input"
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
              data-testid={`finance-company-opt-${c.id}`}
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

/* =================== ALARMI NEPLAĆENIH =================== */
function AlarmiNeplacenih({ onChanged }) {
  const [items, setItems] = useState([]);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  
  const load = async () => {
    setLoading(true);
    const r = await api.get("/finance/overdue", { params: { days } });
    setItems(r.data);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [days]);
  
  const markPaid = async (it, mjData) => {
    if (!confirm(`Označi kao plaćeno: ${it.naziv} — ${MJESECI[mjData.mjesec - 1]} ${mjData.godina}?`)) return;
    await api.post("/finance/payments", {
      company_id: it.company_id,
      godina: mjData.godina,
      mjesec: mjData.mjesec,
      iznos: it.monthly_fee,
      is_paid: true,
      datum_naplate: new Date().toISOString().slice(0, 10),
      napomena: "",
    });
    await load();
    if (onChanged) onChanged();
  };
  
  const totalOwed = items.reduce((a, i) => a + (Number(i.total_owed) || 0), 0);
  const totalMonths = items.reduce((a, i) => a + (i.overdue_months?.length || 0), 0);
  
  return (
    <div>
      <div style={{ background: "linear-gradient(135deg, #fef2f2 0%, #fff7ed 100%)", border: "1px solid #fecaca", borderRadius: 10, padding: 16, marginBottom: 14, display: "flex", alignItems: "center", gap: 14 }}>
        <Warning size={32} weight="fill" color="#ef4444" />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#991b1b", marginBottom: 2 }}>
            {items.length === 0 ? "Sve firme su plaćene." : `${items.length} ${items.length === 1 ? "firma duguje" : "firmi duguje"}`}
          </div>
          <div style={{ fontSize: 12.5, color: "#7f1d1d" }}>
            {items.length > 0 && (
              <>Ukupno dugovanje: <b>{totalOwed.toFixed(2)} €</b> · {totalMonths} neplaćenih mjeseci · grace period: {days} dana</>
            )}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: "#7f1d1d", fontWeight: 500 }}>Grace period:</span>
          <select className="select" value={days} onChange={(e) => setDays(Number(e.target.value))} style={{ width: 110 }} data-testid="grace-period">
            <option value={0}>0 dana</option>
            <option value={15}>15 dana</option>
            <option value={30}>30 dana</option>
            <option value={60}>60 dana</option>
            <option value={90}>90 dana</option>
          </select>
        </div>
      </div>
      
      {loading ? <div style={{ padding: 40, textAlign: "center" }}><Spinner size={24} className="spin" /></div> : items.length === 0 ? (
        <div style={{ background: "white", border: "1px solid var(--border)", borderRadius: 10, padding: 60, textAlign: "center", color: "var(--text-secondary)" }}>
          <CheckCircle size={48} weight="duotone" color="#10b981" style={{ marginBottom: 12 }} />
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Nema dugovanja</div>
          <div style={{ fontSize: 13, color: "var(--text-tertiary)" }}>Sve firme su uredno platile mjesečne naknade u zadanom roku.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {items.map((it) => (
            <div key={it.company_id} style={{ background: "white", border: "1px solid var(--border)", borderLeft: "4px solid #ef4444", borderRadius: 10, padding: 14 }} data-testid={`overdue-${it.company_id}`}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{it.naziv}</div>
                  <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>
                    Mjesečna naknada: <b>{Number(it.monthly_fee).toFixed(2)} €</b> · Najstarije: <b>{it.oldest_due}</b>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#ef4444" }}>{Number(it.total_owed).toFixed(2)} €</div>
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{it.overdue_months.length} mjeseci</div>
                </div>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {it.overdue_months.map((mj, i) => (
                  <button
                    key={i}
                    onClick={() => markPaid(it, mj)}
                    style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 9px", background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", borderRadius: 6, fontSize: 11.5, fontWeight: 500, cursor: "pointer" }}
                    title="Klikni da označiš kao plaćeno"
                  >
                    <Calendar size={11} /> {MJESECI[mj.mjesec - 1]} {mj.godina}
                    <Check size={11} style={{ opacity: 0.5 }} />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color, icon: Icon }) {
  return (
    <div style={{ background: "white", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ width: 36, height: 36, borderRadius: 8, background: `${color}15`, color, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon size={18} weight="bold" />
      </div>
      <div>
        <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", fontWeight: 500, marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 18, fontWeight: 700 }}>{value}</div>
      </div>
    </div>
  );
}

function BigStat({ label, value, color, sub, big }) {
  return (
    <div style={{ background: "white", border: `1px solid ${big ? color : "var(--border)"}`, borderRadius: 10, padding: 16, boxShadow: big ? `0 0 0 3px ${color}15` : "none" }}>
      <div style={{ fontSize: 12, color: "var(--text-tertiary)", fontWeight: 500, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: big ? 26 : 20, fontWeight: 700, color }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}
