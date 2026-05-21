import { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
  FileText, MagnifyingGlass, DownloadSimple, X, Check, Spinner, Sparkle,
  CaretDown, FileDoc, FilePdf, Printer,
} from "@phosphor-icons/react";
import api, { getToken, API } from "@/lib/api";

export default function Documents() {
  const [params] = useSearchParams();
  const initialCompany = params.get("company") || "";

  const [templates, setTemplates] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  const [companyId, setCompanyId] = useState(initialCompany);
  const [employeeId, setEmployeeId] = useState("");
  const [customFields, setCustomFields] = useState({});
  const [generating, setGenerating] = useState(false);
  const [genResult, setGenResult] = useState(null);
  const [genError, setGenError] = useState("");

  useEffect(() => {
    Promise.all([
      api.get("/templates").then((r) => setTemplates(r.data)),
      api.get("/companies").then((r) => setCompanies(r.data)),
    ])
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (companyId) {
      api.get(`/employees?company_id=${companyId}`).then((r) => setEmployees(r.data)).catch(() => setEmployees([]));
    } else {
      setEmployees([]);
    }
    setEmployeeId("");
  }, [companyId]);

  const categories = useMemo(() => {
    const cats = new Set(templates.map((t) => t.category));
    return ["all", ...Array.from(cats).sort()];
  }, [templates]);

  const filtered = templates.filter((t) => {
    if (category !== "all" && t.category !== category) return false;
    if (search) {
      const s = search.toLowerCase();
      return t.name.toLowerCase().includes(s) || t.filename.toLowerCase().includes(s);
    }
    return true;
  });

  const openGenerate = (template) => {
    setSelectedTemplate(template);
    setCustomFields({});
    setGenError("");
    setGenResult(null);
  };

  const generate = async () => {
    if (!selectedTemplate || !companyId) {
      setGenError("Odaberite firmu");
      return;
    }
    setGenerating(true);
    setGenError("");
    try {
      const resp = await api.post("/documents/generate", {
        template_filename: selectedTemplate.filename,
        company_id: companyId,
        employee_id: employeeId || null,
        custom_fields: customFields,
      });
      setGenResult(resp.data);
    } catch (e) {
      setGenError(e.response?.data?.detail || "Greška pri generisanju");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div data-testid="documents-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Generator dokumenata</h1>
          <p className="page-subtitle">
            {templates.length} šablona spremnih za automatsko popunjavanje
          </p>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        <div className="topbar-search" style={{ maxWidth: 400, flex: 1, minWidth: 240 }}>
          <MagnifyingGlass size={15} color="var(--text-tertiary)" />
          <input
            placeholder="Pretraži šablone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="documents-search"
          />
        </div>
        <select className="select" value={category} onChange={(e) => setCategory(e.target.value)} style={{ width: 220 }} data-testid="category-filter">
          {categories.map((c) => (
            <option key={c} value={c}>
              {c === "all" ? "Sve kategorije" : c}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="empty"><Spinner size={28} className="spin" /></div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
          {filtered.map((t) => {
            const isDocx = t.extension === ".docx";
            return (
              <div
                key={t.filename}
                className="card"
                style={{
                  padding: 16,
                  cursor: isDocx ? "pointer" : "default",
                  opacity: isDocx ? 1 : 0.7,
                  transition: "all 150ms",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
                onClick={() => isDocx && openGenerate(t)}
                onMouseEnter={(e) => isDocx && (e.currentTarget.style.borderColor = "#0f172a")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
                data-testid={`template-${t.filename}`}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                  <div
                    style={{
                      width: 36, height: 36, borderRadius: 8,
                      background: isDocx ? "#eff6ff" : "#fef2f2",
                      color: isDocx ? "#1d4ed8" : "#e11d48",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    {isDocx ? <FileDoc size={18} /> : <FilePdf size={18} />}
                  </div>
                  <span className="badge badge-neutral">{t.category}</span>
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13.5, color: "var(--text-primary)", lineHeight: 1.3, marginBottom: 4 }}>
                    {t.name}
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--text-tertiary)" }}>
                    {isDocx ? "Auto-popunjavanje dostupno" : t.extension.toUpperCase().replace(".", "") + " — samo preuzimanje"}
                  </div>
                </div>
                {isDocx ? (
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ marginTop: "auto" }}
                    onClick={(e) => { e.stopPropagation(); openGenerate(t); }}
                  >
                    <Sparkle size={13} /> Generiši
                  </button>
                ) : (
                  <a
                    href={`${API}/documents/download/${t.filename}?token=${getToken()}`}
                    className="btn btn-secondary btn-sm"
                    style={{ marginTop: "auto" }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <DownloadSimple size={13} /> Preuzmi original
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}

      {selectedTemplate && (
        <div className="modal-backdrop" onClick={() => setSelectedTemplate(null)}>
          <div className="modal animate-slide-up" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 600 }}>
            <div className="modal-header">
              <div>
                <div className="modal-title">{selectedTemplate.name}</div>
                <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>{selectedTemplate.category}</div>
              </div>
              <button onClick={() => setSelectedTemplate(null)} style={{ border: "none", background: "transparent", padding: 6 }}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              {!genResult ? (
                <>
                  <div className="field-group" style={{ marginBottom: 14 }}>
                    <label className="field-label">Firma *</label>
                    <select
                      className="select"
                      value={companyId}
                      onChange={(e) => setCompanyId(e.target.value)}
                      data-testid="gen-company-select"
                    >
                      <option value="">— Odaberi firmu —</option>
                      {companies.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.naziv} ({c.pib})
                        </option>
                      ))}
                    </select>
                  </div>

                  {employees.length > 0 && (
                    <div className="field-group" style={{ marginBottom: 14 }}>
                      <label className="field-label">Zaposleni (opciono)</label>
                      <select
                        className="select"
                        value={employeeId}
                        onChange={(e) => setEmployeeId(e.target.value)}
                        data-testid="gen-employee-select"
                      >
                        <option value="">— Bez zaposlenog —</option>
                        {employees.map((emp) => (
                          <option key={emp.id} value={emp.id}>
                            {emp.ime} {emp.prezime} {emp.pozicija ? `· ${emp.pozicija}` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div style={{ padding: 12, background: "#f8fafc", borderRadius: 8, fontSize: 12.5, color: "var(--text-secondary)" }}>
                    <div style={{ fontWeight: 500, marginBottom: 6 }}>ℹ️ Šta će biti automatski popunjeno:</div>
                    Podaci firme (naziv, PIB, adresa, direktor), podaci agencije, današnji datum.
                    {employeeId && " Podaci zaposlenog."}
                    {" "}Sve preostalo iz šablona ostaje kao u originalu — možete urediti u Word-u nakon preuzimanja.
                  </div>

                  {genError && (
                    <div style={{ marginTop: 12, padding: "10px 12px", background: "var(--danger-bg)", color: "var(--danger-text)", borderRadius: 6, fontSize: 13 }} data-testid="gen-error">
                      {genError}
                    </div>
                  )}
                </>
              ) : (
                <div style={{ textAlign: "center", padding: "20px 0" }}>
                  <div style={{ width: 60, height: 60, margin: "0 auto 16px", borderRadius: 12, background: "var(--success-bg)", color: "var(--success-text)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Check size={28} weight="bold" />
                  </div>
                  <div style={{ fontFamily: "Cabinet Grotesk", fontSize: 18, fontWeight: 700, marginBottom: 6 }}>
                    Dokument je spreman!
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-tertiary)", marginBottom: 20 }}>
                    Sva polja su popunjena podacima firme {genResult.record?.company_naziv ? `"${genResult.record.company_naziv}"` : ""}.
                  </div>
                  <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                    <a
                      href={`${API}/documents/preview/${genResult.pdf_filename}?token=${getToken()}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-primary btn-lg"
                      data-testid="open-pdf-btn"
                    >
                      <Printer size={16} /> Otvori PDF za štampu
                    </a>
                    <a
                      href={`${API}/documents/download/${genResult.filename}?token=${getToken()}`}
                      className="btn btn-secondary btn-lg"
                      download
                      data-testid="download-generated-btn"
                    >
                      <DownloadSimple size={16} /> Word (.docx)
                    </a>
                  </div>
                  <div style={{ marginTop: 14, fontSize: 11.5, color: "var(--text-tertiary)" }}>
                    PDF se otvara u novom tabu — pritisnite Ctrl+P za štampu.
                  </div>
                </div>
              )}
            </div>
            {!genResult && (
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setSelectedTemplate(null)}>Odustani</button>
                <button className="btn btn-primary" onClick={generate} disabled={generating || !companyId} data-testid="generate-btn">
                  {generating ? <Spinner size={14} className="spin" /> : <Sparkle size={14} />}
                  Generiši dokument
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
