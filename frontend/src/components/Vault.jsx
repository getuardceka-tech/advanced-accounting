import { useEffect, useMemo, useState } from "react";
import {
  Lock, Plus, MagnifyingGlass, X, Check, Spinner,
  Trash, Pencil, Eye, EyeSlash, Warning, ClockClockwise,
  IdentificationCard, ShieldCheck, Copy
} from "@phosphor-icons/react";
import api from "@/lib/api";

const TIPOVI = [
  { value: "licna_karta", label: "Lična karta", color: "#3b82f6", icon: IdentificationCard },
  { value: "token", label: "Token", color: "#8b5cf6", icon: ShieldCheck },
  { value: "oba", label: "Oba (LK + Token)", color: "#10b981", icon: Lock },
];

const TIP_BY = Object.fromEntries(TIPOVI.map((t) => [t.value, t]));

export default function Vault() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterTip, setFilterTip] = useState("");
  const [filterExpiry, setFilterExpiry] = useState(""); // "expiring" | "expired" | ""
  const [modal, setModal] = useState(null);
  const [revealed, setRevealed] = useState(new Set());
  
  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterTip) params.tip = filterTip;
      if (search) params.q = search;
      const r = await api.get("/vault", { params });
      setItems(r.data || []);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterTip, search]);
  
  const visibleItems = useMemo(() => {
    if (filterExpiry === "expiring") return items.filter((i) => i.is_expiring && !i.is_expired);
    if (filterExpiry === "expired") return items.filter((i) => i.is_expired);
    return items;
  }, [items, filterExpiry]);
  
  const stats = useMemo(() => ({
    total: items.length,
    expiring: items.filter((i) => i.is_expiring && !i.is_expired).length,
    expired: items.filter((i) => i.is_expired).length,
  }), [items]);
  
  const toggleReveal = (id) => {
    const s = new Set(revealed);
    if (s.has(id)) s.delete(id); else s.add(id);
    setRevealed(s);
  };
  
  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    // Brzi vizuelni feedback
    const el = document.createElement("div");
    el.textContent = `✓ ${label} kopirano`;
    el.style.cssText = "position:fixed;top:80px;right:20px;background:#10b981;color:white;padding:10px 16px;border-radius:8px;z-index:9999;font-size:13px;font-weight:500;box-shadow:0 4px 12px rgba(0,0,0,0.15)";
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1500);
  };
  
  const remove = async (id, naziv) => {
    if (!confirm(`Obrisati lozinku za "${naziv}"?`)) return;
    await api.delete(`/vault/${id}`);
    await load();
  };
  
  return (
    <div data-testid="vault-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Passwordi za token / lične karte</h1>
          <p className="page-subtitle">
            Sigurno čuvanje PIN-ova, PUK-ova i passwordа tokena klijenata. Tokeni blizu isteka označeni crveno.
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setModal({ entry: { tip: "licna_karta", naziv: "" } })}
          data-testid="add-vault-btn"
        >
          <Plus size={15} /> Dodaj password
        </button>
      </div>
      
      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
        <StatCard label="Ukupno čuvanih" value={stats.total} color="#64748b" icon={Lock} onClick={() => setFilterExpiry("")} active={!filterExpiry} />
        <StatCard label="Ističe za <2 mjeseca" value={stats.expiring} color="#f59e0b" icon={ClockClockwise} onClick={() => setFilterExpiry(filterExpiry === "expiring" ? "" : "expiring")} active={filterExpiry === "expiring"} />
        <StatCard label="Već isteklo" value={stats.expired} color="#ef4444" icon={Warning} onClick={() => setFilterExpiry(filterExpiry === "expired" ? "" : "expired")} active={filterExpiry === "expired"} />
      </div>
      
      {/* Filteri */}
      <div style={{ background: "white", border: "1px solid var(--border)", borderRadius: 10, padding: 14, marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
            <MagnifyingGlass size={15} style={{ position: "absolute", left: 11, top: 11, color: "var(--text-tertiary)" }} />
            <input
              className="input"
              placeholder="Pretraži po imenu, broju lične, napomeni..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: 32 }}
              data-testid="vault-search"
            />
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <FilterChip active={!filterTip} onClick={() => setFilterTip("")} label="Sve" />
            {TIPOVI.map((t) => (
              <FilterChip
                key={t.value}
                active={filterTip === t.value}
                onClick={() => setFilterTip(filterTip === t.value ? "" : t.value)}
                label={t.label}
                color={t.color}
              />
            ))}
          </div>
        </div>
      </div>
      
      {/* Tabela */}
      <div style={{ background: "white", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
        {loading && <div style={{ padding: 40, textAlign: "center" }}><Spinner size={24} className="spin" /></div>}
        {!loading && visibleItems.length === 0 && (
          <div style={{ padding: 50, textAlign: "center", color: "var(--text-tertiary)" }}>
            <Lock size={42} style={{ marginBottom: 10, opacity: 0.4 }} />
            <div style={{ fontSize: 15, marginBottom: 4 }}>Nema sačuvanih lozinki</div>
            <div style={{ fontSize: 12.5 }}>Dodaj novi PIN/PUK ili password tokena</div>
          </div>
        )}
        {!loading && visibleItems.length > 0 && (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead style={{ background: "#f8fafc", borderBottom: "1px solid var(--border)" }}>
              <tr>
                <th style={thStyle}>Klijent / Firma</th>
                <th style={thStyle}>Tip</th>
                <th style={thStyle}>PIN</th>
                <th style={thStyle}>PUK</th>
                <th style={thStyle}>CAN</th>
                <th style={thStyle}>Br. lične</th>
                <th style={thStyle}>Token Password</th>
                <th style={thStyle}>Datum isteka</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Akcije</th>
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((it) => {
                const isRevealed = revealed.has(it.id);
                const t = TIP_BY[it.tip] || TIP_BY.licna_karta;
                const TIcon = t.icon;
                let dateColor = "var(--text-secondary)";
                let dateBg = "transparent";
                if (it.is_expired) { dateColor = "#ef4444"; dateBg = "#fee2e2"; }
                else if (it.is_expiring) { dateColor = "#f59e0b"; dateBg = "#fef3c7"; }
                return (
                  <tr key={it.id} style={{ borderBottom: "1px solid var(--border-light)", background: it.is_expired ? "#fef2f2" : it.is_expiring ? "#fffbeb" : "white" }} data-testid={`vault-row-${it.id}`}>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{it.naziv}</td>
                    <td style={tdStyle}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, fontWeight: 500, color: t.color, background: `${t.color}15`, padding: "3px 7px", borderRadius: 10 }}>
                        <TIcon size={11} weight="fill" /> {t.label}
                      </span>
                    </td>
                    <SecretCell value={it.pin} revealed={isRevealed} onCopy={() => copyToClipboard(it.pin, "PIN")} />
                    <SecretCell value={it.puk} revealed={isRevealed} onCopy={() => copyToClipboard(it.puk, "PUK")} />
                    <SecretCell value={it.can} revealed={isRevealed} onCopy={() => copyToClipboard(it.can, "CAN")} />
                    <td style={{ ...tdStyle, fontSize: 12.5, color: "var(--text-secondary)" }}>{it.broj_licne || "—"}</td>
                    <SecretCell value={it.token_password} revealed={isRevealed} onCopy={() => copyToClipboard(it.token_password, "Token password")} />
                    <td style={tdStyle}>
                      {it.datum_isteka ? (
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: dateColor, background: dateBg, padding: "3px 8px", borderRadius: 10, fontWeight: 500 }}>
                          {it.is_expired && <Warning size={11} weight="fill" />}
                          {it.is_expiring && !it.is_expired && <ClockClockwise size={11} weight="fill" />}
                          {new Date(it.datum_isteka).toLocaleDateString("sr-Latn-ME")}
                          {it.days_to_expiry !== null && (
                            <span style={{ opacity: 0.8 }}>({it.days_to_expiry < 0 ? `${-it.days_to_expiry}d isteklo` : `za ${it.days_to_expiry}d`})</span>
                          )}
                        </div>
                      ) : "—"}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: 4 }}>
                        <button
                          className="btn btn-secondary"
                          onClick={() => toggleReveal(it.id)}
                          style={{ padding: "4px 7px" }}
                          title={isRevealed ? "Sakrij" : "Prikaži"}
                          data-testid={`reveal-${it.id}`}
                        >
                          {isRevealed ? <EyeSlash size={12} /> : <Eye size={12} />}
                        </button>
                        <button
                          className="btn btn-secondary"
                          onClick={() => setModal({ entry: it })}
                          style={{ padding: "4px 7px" }}
                          title="Izmijeni"
                          data-testid={`edit-vault-${it.id}`}
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          className="btn btn-secondary"
                          onClick={() => remove(it.id, it.naziv)}
                          style={{ padding: "4px 7px", color: "var(--danger, #ef4444)" }}
                          title="Obriši"
                          data-testid={`delete-vault-${it.id}`}
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
        <VaultModal
          entry={modal.entry}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load(); }}
        />
      )}
    </div>
  );
}

const thStyle = { padding: "11px 12px", textAlign: "left", fontWeight: 600, fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: 0.4 };
const tdStyle = { padding: "10px 12px" };

function SecretCell({ value, revealed, onCopy }) {
  if (!value) return <td style={{ ...tdStyle, color: "var(--text-tertiary)" }}>—</td>;
  return (
    <td style={tdStyle}>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 5, fontFamily: "JetBrains Mono, monospace", fontSize: 12.5 }}>
        <span>{revealed ? value : "•".repeat(Math.min(value.length, 6))}</span>
        <button
          onClick={onCopy}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: "var(--text-tertiary)" }}
          title="Kopiraj"
        >
          <Copy size={11} />
        </button>
      </div>
    </td>
  );
}

function StatCard({ label, value, color, icon: Icon, onClick, active }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: "white",
        border: `1px solid ${active ? color : "var(--border)"}`,
        borderRadius: 10,
        padding: "14px 16px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        cursor: onClick ? "pointer" : "default",
        boxShadow: active ? `0 0 0 3px ${color}25` : "none",
        transition: "all 0.15s",
      }}
    >
      <div style={{ width: 36, height: 36, borderRadius: 8, background: `${color}15`, color, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon size={18} weight="bold" />
      </div>
      <div>
        <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", fontWeight: 500, marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
      </div>
    </div>
  );
}

function FilterChip({ active, onClick, label, color = "var(--accent)" }) {
  return (
    <button
      onClick={onClick}
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

function VaultModal({ entry, onClose, onSaved }) {
  const isNew = !entry.id;
  const [form, setForm] = useState({
    naziv: entry.naziv || "",
    tip: entry.tip || "licna_karta",
    pin: entry.pin || "",
    puk: entry.puk || "",
    can: entry.can || "",
    broj_licne: entry.broj_licne || "",
    token_password: entry.token_password || "",
    token_serial: entry.token_serial || "",
    datum_preuzimanja: entry.datum_preuzimanja || "",
    datum_isteka: entry.datum_isteka || "",
    napomena: entry.napomena || "",
  });
  const [busy, setBusy] = useState(false);
  
  const u = (k, v) => setForm({ ...form, [k]: v });
  
  const save = async () => {
    if (!form.naziv.trim()) {
      alert("Ime i prezime ili naziv firme je obavezno");
      return;
    }
    setBusy(true);
    try {
      if (isNew) {
        await api.post("/vault", form);
      } else {
        await api.patch(`/vault/${entry.id}`, form);
      }
      onSaved();
    } catch (e) {
      alert(`Greška: ${e.response?.data?.detail || e.message}`);
    } finally {
      setBusy(false);
    }
  };
  
  const showLK = form.tip === "licna_karta" || form.tip === "oba";
  const showTok = form.tip === "token" || form.tip === "oba";
  
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal animate-slide-up" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 600 }}>
        <div className="modal-header">
          <div className="modal-title">{isNew ? "Nova lozinka" : "Izmijeni lozinku"}</div>
          <button onClick={onClose} style={{ border: "none", background: "transparent", padding: 6 }}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div className="field-group" style={{ gridColumn: "1/-1" }}>
              <label className="field-label">Ime i prezime / Naziv firme *</label>
              <input className="input" value={form.naziv} onChange={(e) => u("naziv", e.target.value)} placeholder="Npr. MARKO MARKOVIĆ ili DOO TRADE" autoFocus data-testid="vault-naziv" />
            </div>
            
            <div className="field-group" style={{ gridColumn: "1/-1" }}>
              <label className="field-label">Tip</label>
              <div style={{ display: "flex", gap: 6 }}>
                {TIPOVI.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => u("tip", t.value)}
                    style={{
                      flex: 1,
                      padding: "10px 12px",
                      borderRadius: 8,
                      border: `1px solid ${form.tip === t.value ? t.color : "var(--border)"}`,
                      background: form.tip === t.value ? `${t.color}15` : "white",
                      color: form.tip === t.value ? t.color : "var(--text-secondary)",
                      cursor: "pointer",
                      fontSize: 12.5,
                      fontWeight: form.tip === t.value ? 600 : 500,
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 6
                    }}
                    data-testid={`vault-tip-${t.value}`}
                  >
                    <t.icon size={13} weight="fill" /> {t.label}
                  </button>
                ))}
              </div>
            </div>
            
            {showLK && (
              <>
                <div style={{ gridColumn: "1/-1", padding: 12, background: "#eff6ff", borderRadius: 8, marginTop: 4 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#1e40af", marginBottom: 10 }}>🪪 LIČNA KARTA</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 }}>
                    <Field label="PIN" value={form.pin} onChange={(v) => u("pin", v)} placeholder="4-6 cifara" />
                    <Field label="PUK" value={form.puk} onChange={(v) => u("puk", v)} placeholder="PUK kod" />
                    <Field label="CAN" value={form.can} onChange={(v) => u("can", v)} placeholder="CAN broj" />
                    <Field label="Broj lične" value={form.broj_licne} onChange={(v) => u("broj_licne", v)} placeholder="000000000" />
                  </div>
                </div>
              </>
            )}
            
            {showTok && (
              <>
                <div style={{ gridColumn: "1/-1", padding: 12, background: "#faf5ff", borderRadius: 8, marginTop: 4 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#7c3aed", marginBottom: 10 }}>🔐 TOKEN</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <Field label="Token password" value={form.token_password} onChange={(v) => u("token_password", v)} placeholder="Password tokena" />
                    <Field label="Serijski broj tokena" value={form.token_serial} onChange={(v) => u("token_serial", v)} placeholder="Opciono" />
                  </div>
                </div>
              </>
            )}
            
            <Field label="Datum preuzimanja" value={form.datum_preuzimanja} onChange={(v) => u("datum_preuzimanja", v)} type="date" />
            <Field label="Datum isteka" value={form.datum_isteka} onChange={(v) => u("datum_isteka", v)} type="date" testid="vault-datum-isteka" />
            
            <div className="field-group" style={{ gridColumn: "1/-1" }}>
              <label className="field-label">Napomena</label>
              <textarea className="input" value={form.napomena} onChange={(e) => u("napomena", e.target.value)} rows={2} placeholder="Bilo koje dodatne informacije..." />
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Odustani</button>
          <button className="btn btn-primary" onClick={save} disabled={busy} data-testid="save-vault-btn">
            {busy ? <Spinner size={14} className="spin" /> : <Check size={14} />} Sačuvaj
          </button>
        </div>
      </div>
    </div>
  );
}

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
