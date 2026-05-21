import { useEffect, useState } from "react";
import { CalendarBlank, Check, Printer, FileXls } from "@phosphor-icons/react";
import api from "@/lib/api";

const months = [
  "Januar", "Februar", "Mart", "April", "Maj", "Jun",
  "Jul", "Avgust", "Septembar", "Oktobar", "Novembar", "Decembar",
];

export default function PdvTracking() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("both"); // pdv/ioppd/both

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get(`/pdv-tracking?year=${year}&month=${month}`);
      setData(r.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [year, month]); // eslint-disable-line

  const toggleStatus = async (row, field) => {
    const newVal = !row[field];
    const update = { [field]: newVal };
    if (newVal && !row[field.replace("_predato", "_datum")]) {
      update[field.replace("_predato", "_datum")] = new Date().toISOString().slice(0, 10);
    }
    await api.put(`/pdv-tracking/${row.company_id}?year=${year}&month=${month}`, update);
    setData((d) => d.map((r) => (r.company_id === row.company_id ? { ...r, ...update } : r)));
  };

  const updateField = async (row, field, value) => {
    const update = { [field]: value };
    await api.put(`/pdv-tracking/${row.company_id}?year=${year}&month=${month}`, update);
    setData((d) => d.map((r) => (r.company_id === row.company_id ? { ...r, ...update } : r)));
  };

  const pdvRows = data.filter((r) => r.pdv_obveznik);
  const ioppdRows = data.filter((r) => r.ioppd_obveznik);

  const pdvDone = pdvRows.filter((r) => r.pdv_predato).length;
  const ioppdDone = ioppdRows.filter((r) => r.ioppd_predato).length;

  const printList = (type) => {
    window.print();
  };

  return (
    <div data-testid="pdv-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">PDV / IOPPD praćenje</h1>
          <p className="page-subtitle">
            Mjesečne liste obveznika i status predaje
          </p>
        </div>
        <button className="btn btn-secondary" onClick={() => window.print()} data-testid="print-btn">
          <Printer size={14} /> Štampaj listu
        </button>
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 24, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", background: "white", padding: "6px 10px", border: "1px solid var(--border)", borderRadius: 7 }}>
          <CalendarBlank size={15} color="var(--text-tertiary)" />
          <select className="select" style={{ border: "none", padding: "4px 4px", width: 140 }} value={month} onChange={(e) => setMonth(Number(e.target.value))} data-testid="month-select">
            {months.map((m, i) => (
              <option key={i} value={i + 1}>{m}</option>
            ))}
          </select>
          <select className="select" style={{ border: "none", padding: "4px 4px", width: 84 }} value={year} onChange={(e) => setYear(Number(e.target.value))} data-testid="year-select">
            {[2024, 2025, 2026, 2027].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", gap: 4, background: "white", padding: 4, borderRadius: 7, border: "1px solid var(--border)" }}>
          {[
            { v: "both", label: "Sve" },
            { v: "pdv", label: "Samo PDV" },
            { v: "ioppd", label: "Samo IOPPD" },
          ].map((f) => (
            <button
              key={f.v}
              onClick={() => setView(f.v)}
              data-testid={`view-${f.v}`}
              style={{
                padding: "5px 12px", fontSize: 12.5, fontWeight: 500,
                border: "none", borderRadius: 4,
                background: view === f.v ? "#0f172a" : "transparent",
                color: view === f.v ? "white" : "var(--text-secondary)",
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        <div style={{ display: "flex", gap: 14, fontSize: 12.5, color: "var(--text-secondary)" }}>
          <div>
            <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>PDV:</span> {pdvDone}/{pdvRows.length} predato
          </div>
          <div>
            <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>IOPPD:</span> {ioppdDone}/{ioppdRows.length} predato
          </div>
        </div>
      </div>

      {loading ? (
        <div className="empty">Učitavam...</div>
      ) : data.length === 0 ? (
        <div className="empty">
          <div className="empty-title">Nema obveznika za prikaz</div>
          <div className="empty-text">
            Označite PDV/IOPPD obveznika u kartici firme da se pojavi ovdje.
          </div>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Firma</th>
                <th>PIB</th>
                {(view === "both" || view === "pdv") && (
                  <>
                    <th>PDV</th>
                    <th>Datum PDV</th>
                    <th>Br. PDV</th>
                  </>
                )}
                {(view === "both" || view === "ioppd") && (
                  <>
                    <th>IOPPD</th>
                    <th>Datum IOPPD</th>
                    <th>Br. IOPPD</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {data.map((row, idx) => {
                if (view === "pdv" && !row.pdv_obveznik) return null;
                if (view === "ioppd" && !row.ioppd_obveznik) return null;
                return (
                  <tr key={row.company_id} data-testid={`pdv-row-${idx}`}>
                    <td style={{ fontWeight: 500 }}>{row.company_naziv}</td>
                    <td style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 12.5 }}>{row.pib}</td>

                    {(view === "both" || view === "pdv") && (
                      <>
                        <td>
                          {row.pdv_obveznik ? (
                            <Checkbox
                              checked={row.pdv_predato}
                              onChange={() => toggleStatus(row, "pdv_predato")}
                              testid={`pdv-check-${idx}`}
                            />
                          ) : <span style={{ color: "var(--text-tertiary)" }}>—</span>}
                        </td>
                        <td>
                          {row.pdv_obveznik ? (
                            <input
                              type="date"
                              className="input"
                              style={{ padding: "4px 8px", fontSize: 12 }}
                              value={row.pdv_datum || ""}
                              onChange={(e) => updateField(row, "pdv_datum", e.target.value)}
                            />
                          ) : "—"}
                        </td>
                        <td>
                          {row.pdv_obveznik ? (
                            <input
                              type="text"
                              className="input"
                              placeholder="—"
                              style={{ padding: "4px 8px", fontSize: 12, width: 120 }}
                              value={row.pdv_broj || ""}
                              onChange={(e) => updateField(row, "pdv_broj", e.target.value)}
                            />
                          ) : "—"}
                        </td>
                      </>
                    )}

                    {(view === "both" || view === "ioppd") && (
                      <>
                        <td>
                          {row.ioppd_obveznik ? (
                            <Checkbox
                              checked={row.ioppd_predato}
                              onChange={() => toggleStatus(row, "ioppd_predato")}
                              testid={`ioppd-check-${idx}`}
                            />
                          ) : <span style={{ color: "var(--text-tertiary)" }}>—</span>}
                        </td>
                        <td>
                          {row.ioppd_obveznik ? (
                            <input
                              type="date"
                              className="input"
                              style={{ padding: "4px 8px", fontSize: 12 }}
                              value={row.ioppd_datum || ""}
                              onChange={(e) => updateField(row, "ioppd_datum", e.target.value)}
                            />
                          ) : "—"}
                        </td>
                        <td>
                          {row.ioppd_obveznik ? (
                            <input
                              type="text"
                              className="input"
                              placeholder="—"
                              style={{ padding: "4px 8px", fontSize: 12, width: 120 }}
                              value={row.ioppd_broj || ""}
                              onChange={(e) => updateField(row, "ioppd_broj", e.target.value)}
                            />
                          ) : "—"}
                        </td>
                      </>
                    )}
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

const Checkbox = ({ checked, onChange, testid }) => (
  <button
    onClick={onChange}
    className={`checkbox ${checked ? "checked" : ""}`}
    data-testid={testid}
    style={{ border: "none", padding: 0 }}
  >
    {checked && <Check size={11} weight="bold" />}
  </button>
);
