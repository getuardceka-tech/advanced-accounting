import { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
  FileText, MagnifyingGlass, DownloadSimple, X, Check, Spinner, Sparkle,
  CaretDown, FileDoc, FilePdf, Printer, ClockCounterClockwise, Trash, PencilSimple,
} from "@phosphor-icons/react";
import api, { getToken, API } from "@/lib/api";

export default function Documents() {
  const [params] = useSearchParams();
  const initialCompany = params.get("company") || "";

  const [templates, setTemplates] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  const [tab, setTab] = useState("sabloni"); // sabloni | istorija
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyCompanyFilter, setHistoryCompanyFilter] = useState("");

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  const [companyId, setCompanyId] = useState(initialCompany);
  const [companySearch, setCompanySearch] = useState("");
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

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const params = historyCompanyFilter ? `?company_id=${historyCompanyFilter}` : "";
      const res = await api.get(`/documents/history${params}`);
      setHistory(res.data);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (tab === "istorija") loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, historyCompanyFilter]);

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
  
  const filteredCompanies = useMemo(() => {
    if (!companySearch.trim()) return [];
    const s = companySearch.toLowerCase().trim();
    return companies.filter((c) =>
      (c.naziv || "").toLowerCase().includes(s) ||
      (c.naziv_skraceni || "").toLowerCase().includes(s) ||
      (c.pib || "").toLowerCase().includes(s) ||
      (c.direktor_ime || "").toLowerCase().includes(s) ||
      (c.grad || "").toLowerCase().includes(s)
    );
  }, [companies, companySearch]);

  const openGenerate = (template) => {
    setSelectedTemplate(template);
    setCustomFields({});
    setGenError("");
    setGenResult(null);
  };

  // Pri kliku na zapis u istoriji — učitaj sve i otvori modal sa popunjenim poljima
  const openFromHistory = (record) => {
    const tpl = templates.find((t) => t.filename === record.template_filename || t.filename === record.template);
    if (!tpl) {
      alert("Šablon više ne postoji u sistemu");
      return;
    }
    setSelectedTemplate(tpl);
    setCompanyId(record.company_id);
    setCompanySearch(record.company_naziv || "");
    setEmployeeId(record.employee_id || "");
    // Učitaj prethodne vrijednosti, ali postavi tip = "promjena" da odmah pravi promjenu podataka
    setCustomFields({ ...(record.custom_fields || {}), tip_prijave: "promjena" });
    setGenError("");
    setGenResult(null);
    setTab("sabloni");
  };

  const deleteHistoryItem = async (id) => {
    if (!window.confirm("Sigurno želiš da obrišeš ovaj zapis?")) return;
    try {
      await api.delete(`/documents/history/${id}`);
      setHistory((h) => h.filter((r) => r.id !== id));
    } catch {
      alert("Greška pri brisanju");
    }
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
      // Refresh history u pozadini
      if (tab === "istorija") loadHistory();
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

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 18, borderBottom: "1px solid var(--border)" }}>
        <button
          type="button"
          onClick={() => setTab("sabloni")}
          data-testid="tab-sabloni"
          style={{
            padding: "10px 16px",
            background: "transparent",
            border: "none",
            borderBottom: tab === "sabloni" ? "2px solid #0f172a" : "2px solid transparent",
            color: tab === "sabloni" ? "#0f172a" : "var(--text-tertiary)",
            fontWeight: tab === "sabloni" ? 700 : 500,
            fontSize: 13.5,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <FileText size={16} /> Šabloni
        </button>
        <button
          type="button"
          onClick={() => setTab("istorija")}
          data-testid="tab-istorija"
          style={{
            padding: "10px 16px",
            background: "transparent",
            border: "none",
            borderBottom: tab === "istorija" ? "2px solid #0f172a" : "2px solid transparent",
            color: tab === "istorija" ? "#0f172a" : "var(--text-tertiary)",
            fontWeight: tab === "istorija" ? 700 : 500,
            fontSize: 13.5,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <ClockCounterClockwise size={16} /> Istorija prijava
          {history.length > 0 && (
            <span style={{ background: "#0f172a", color: "white", borderRadius: 10, padding: "1px 8px", fontSize: 11, fontWeight: 600 }}>
              {history.length}
            </span>
          )}
        </button>
      </div>

      {tab === "istorija" ? (
        <DocumentsHistory
          history={history}
          loading={historyLoading}
          companies={companies}
          filter={historyCompanyFilter}
          setFilter={setHistoryCompanyFilter}
          onOpen={openFromHistory}
          onDelete={deleteHistoryItem}
        />
      ) : (
        <>
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
            const canGenerate = t.supports_generation;
            const isDocx = t.extension === ".docx";
            const isPdfForm = t.is_pdf_form;
            return (
              <div
                key={t.filename}
                className="card"
                style={{
                  padding: 16,
                  cursor: canGenerate ? "pointer" : "default",
                  opacity: canGenerate || t.extension === ".pdf" ? 1 : 0.7,
                  transition: "all 150ms",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
                onClick={() => canGenerate && openGenerate(t)}
                onMouseEnter={(e) => canGenerate && (e.currentTarget.style.borderColor = "#0f172a")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
                data-testid={`template-${t.filename}`}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                  <div
                    style={{
                      width: 36, height: 36, borderRadius: 8,
                      background: isDocx ? "#eff6ff" : (isPdfForm ? "#ecfdf5" : "#fef2f2"),
                      color: isDocx ? "#1d4ed8" : (isPdfForm ? "#047857" : "#e11d48"),
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
                    {canGenerate
                      ? (isPdfForm ? "PDF obrazac · auto-popunjavanje (overlay)" : "Auto-popunjavanje dostupno")
                      : (t.extension === ".pdf" ? "PDF za štampu (originalni obrazac)" : t.extension.toUpperCase().replace(".", "") + " — samo preuzimanje")}
                  </div>
                </div>
                {canGenerate ? (
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ marginTop: "auto" }}
                    onClick={(e) => { e.stopPropagation(); openGenerate(t); }}
                    data-testid={`generate-btn-${t.filename}`}
                  >
                    <Sparkle size={13} /> Generiši
                  </button>
                ) : t.extension === ".pdf" ? (
                  <div style={{ display: "flex", gap: 6, marginTop: "auto" }}>
                    <a
                      href={`${API}/documents/preview/${t.filename}?token=${getToken()}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-primary btn-sm"
                      style={{ flex: 1 }}
                      onClick={(e) => e.stopPropagation()}
                      data-testid={`preview-template-${t.filename}`}
                    >
                      <Printer size={13} /> Otvori za štampu
                    </a>
                    <a
                      href={`${API}/documents/download/${t.filename}?token=${getToken()}`}
                      className="btn btn-secondary btn-sm"
                      onClick={(e) => e.stopPropagation()}
                      title="Preuzmi PDF"
                    >
                      <DownloadSimple size={13} />
                    </a>
                  </div>
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
        </>
      )}

      {selectedTemplate && (
        <div className="modal-backdrop" onClick={() => setSelectedTemplate(null)}>
          <div className="modal animate-slide-up" onClick={(e) => e.stopPropagation()} style={{ maxWidth: selectedTemplate.is_pdf_form ? 760 : 600 }}>
            <div className="modal-header">
              <div>
                <div className="modal-title">{selectedTemplate.is_pdf_form ? `Nova ${selectedTemplate.name.toLowerCase()}` : selectedTemplate.name}</div>
                <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>{selectedTemplate.category}</div>
              </div>
              <button onClick={() => setSelectedTemplate(null)} style={{ border: "none", background: "transparent", padding: 6 }} data-testid="close-modal-btn">
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              {!genResult ? (
                <>
                  <div className="field-group" style={{ marginBottom: 14 }}>
                    <label className="field-label">
                      {selectedTemplate.is_pdf_form ? "Auto-popunjavanje iz klijenta" : "Firma *"} (ukucaj naziv, PIB ili direktora)
                    </label>
                    <input
                      type="text"
                      className="input"
                      placeholder="Pretraga po nazivu ili PIB-u..."
                      value={companySearch}
                      onChange={(e) => setCompanySearch(e.target.value)}
                      data-testid="gen-company-search"
                      style={{ marginBottom: 6 }}
                      autoFocus
                    />
                    {!companySearch.trim() ? (
                      <div style={{ padding: "12px 14px", border: "1px dashed var(--border)", borderRadius: 8, fontSize: 12.5, color: "var(--text-tertiary)", textAlign: "center" }}>
                        Počni da kucaš da vidiš rezultate ({companies.length} firmi u bazi)
                      </div>
                    ) : filteredCompanies.length === 0 ? (
                      <div style={{ padding: "12px 14px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12.5, color: "var(--text-tertiary)", textAlign: "center" }}>
                        Nema rezultata za "{companySearch}"
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 240, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 8, padding: 6 }}>
                        {filteredCompanies.map((c) => {
                          const selected = companyId === c.id;
                          return (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => setCompanyId(c.id)}
                              data-testid={`company-option-${c.id}`}
                              style={{
                                textAlign: "left",
                                padding: "10px 12px",
                                borderRadius: 6,
                                border: selected ? "2px solid #0f172a" : "1px solid transparent",
                                background: selected ? "#0f172a" : "white",
                                color: selected ? "white" : "var(--text-primary)",
                                cursor: "pointer",
                                fontSize: 13,
                                fontWeight: selected ? 600 : 500,
                                transition: "all 120ms",
                              }}
                              onMouseEnter={(e) => !selected && (e.currentTarget.style.background = "#f1f5f9")}
                              onMouseLeave={(e) => !selected && (e.currentTarget.style.background = "white")}
                            >
                              <div>{c.naziv_skraceni || c.naziv}</div>
                              {c.pib && (
                                <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>
                                  PIB {c.pib} {c.direktor_ime ? `· ${c.direktor_ime}` : ""}
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {companySearch.trim() && filteredCompanies.length > 0 && (
                      <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginTop: 4 }}>
                        {filteredCompanies.length} {filteredCompanies.length === 1 ? "rezultat" : "rezultata"} {filteredCompanies.length === 1 ? "pronađen" : "pronađeno"} · klikni da izabereš
                      </div>
                    )}
                  </div>

                  {employees.length > 0 && !selectedTemplate.is_pdf_form && (
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
                  
                  {/* Extras za Zahtjev za uzorkovanje (BRIS / HRANA / VODA) */}
                  {selectedTemplate && selectedTemplate.filename.toLowerCase().includes("uzorkovanje") && (
                    <ExtrasZahtjev
                      template={selectedTemplate}
                      values={customFields}
                      onChange={setCustomFields}
                      company={companies.find(c => c.id === companyId)}
                    />
                  )}
                  
                  {/* Extras za Prijava zanatstva i Prijava trgovine */}
                  {selectedTemplate && (
                    (selectedTemplate.filename.toLowerCase().includes("prijava zanatstva") ||
                     selectedTemplate.filename.toLowerCase().includes("prijava_zanatstva") ||
                     selectedTemplate.filename.toLowerCase().includes("prijava trgovine") ||
                     selectedTemplate.filename.toLowerCase().includes("prijava_trgovine")) && (
                      <ExtrasPrijava
                        template={selectedTemplate}
                        values={customFields}
                        onChange={setCustomFields}
                      />
                    )
                  )}

                  {!selectedTemplate.is_pdf_form && (
                    <div style={{ padding: 12, background: "#f8fafc", borderRadius: 8, fontSize: 12.5, color: "var(--text-secondary)" }}>
                      <div style={{ fontWeight: 500, marginBottom: 6 }}>ℹ️ Šta će biti automatski popunjeno:</div>
                      Podaci firme (naziv, PIB, adresa, direktor), podaci agencije, današnji datum.
                      {employeeId && " Podaci zaposlenog."}
                      {" "}Sve preostalo iz šablona ostaje kao u originalu — možete urediti u Word-u nakon preuzimanja.
                    </div>
                  )}

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
                    {!selectedTemplate.is_pdf_form && genResult.filename && genResult.filename.endsWith('.docx') && (
                      <a
                        href={`${API}/documents/download/${genResult.filename}?token=${getToken()}`}
                        className="btn btn-secondary btn-lg"
                        download
                        data-testid="download-generated-btn"
                      >
                        <DownloadSimple size={16} /> Word (.docx)
                      </a>
                    )}
                    {selectedTemplate.is_pdf_form && (
                      <a
                        href={`${API}/documents/download/${genResult.pdf_filename}?token=${getToken()}`}
                        className="btn btn-secondary btn-lg"
                        download
                        data-testid="download-generated-btn"
                      >
                        <DownloadSimple size={16} /> Preuzmi PDF
                      </a>
                    )}
                  </div>
                  <div style={{ marginTop: 14, fontSize: 11.5, color: "var(--text-tertiary)" }}>
                    PDF se otvara u novom tabu — pritisnite Ctrl+P za štampu.
                  </div>
                </div>
              )}
            </div>
            {!genResult && (
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setSelectedTemplate(null)} data-testid="cancel-generate-btn">Odustani</button>
                <button className="btn btn-primary" onClick={generate} disabled={generating || !companyId} data-testid="generate-btn">
                  {generating ? <Spinner size={14} className="spin" /> : <Sparkle size={14} />}
                  {selectedTemplate.is_pdf_form ? "Kreiraj prijavu" : "Generiši dokument"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


function ExtrasZahtjev({ template, values, onChange, company }) {
  const fn = (template?.filename || "").toLowerCase();
  const isVoda = fn.includes("voda");
  
  const [savedObjects, setSavedObjects] = useState([]);
  
  useEffect(() => {
    if (!company?.id) { setSavedObjects([]); return; }
    api.get(`/companies/${company.id}/objekti`)
      .then((r) => setSavedObjects(r.data || []))
      .catch(() => setSavedObjects([]));
  }, [company?.id]);
  
  const u = (k, v) => onChange({ ...values, [k]: v });
  
  const useObject = (obj) => {
    onChange({ ...values, naziv_objekta: obj.naziv_objekta, adresa_objekta: obj.adresa_objekta });
  };
  
  // Default naziv objekta: skraćeni naziv firme
  const defaultObjName = company?.naziv_skraceni || company?.naziv || "";
  const defaultObjAddr = company?.adresa || "";
  
  return (
    <div style={{ marginTop: 8, marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "8px 0 10px 0", paddingBottom: 6, borderBottom: "1px solid var(--border)" }}>
        <div style={{ width: 22, height: 22, borderRadius: 6, background: "#0f172a", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>1</div>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text-primary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Podaci o objektu</div>
      </div>
      
      {savedObjects.length > 0 && (
        <div style={{ marginBottom: 12, padding: 10, background: "#fefce8", border: "1px solid #fde047", borderRadius: 8 }}>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: "#854d0e", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            💾 Prethodno korišćeni objekti za ovu firmu
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {savedObjects.map((obj) => (
              <button
                key={obj.naziv_objekta}
                type="button"
                onClick={() => useObject(obj)}
                data-testid={`obj-suggestion-${obj.naziv_objekta}`}
                style={{
                  padding: "5px 10px",
                  borderRadius: 6,
                  border: "1px solid #ca8a04",
                  background: "white",
                  color: "#854d0e",
                  fontSize: 12,
                  cursor: "pointer",
                  fontWeight: 500,
                  transition: "all 120ms",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#fef9c3")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "white")}
                title={obj.adresa_objekta ? `Adresa: ${obj.adresa_objekta}` : ""}
              >
                {obj.naziv_objekta}
              </button>
            ))}
          </div>
        </div>
      )}
      
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
        <div className="field-group">
          <label className="field-label">Naziv objekta *</label>
          <input
            className="input"
            placeholder={defaultObjName ? `Npr. ${defaultObjName}` : "Naziv objekta"}
            value={values.naziv_objekta ?? ""}
            onChange={(e) => u("naziv_objekta", e.target.value)}
            data-testid="zahtjev-naziv-objekta"
            autoFocus
          />
          <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>
            Sistem će zapamtiti ovaj objekat za buduće prijave ove firme.
          </div>
        </div>
        <div className="field-group">
          <label className="field-label">Adresa objekta</label>
          <input
            className="input"
            placeholder={defaultObjAddr ? `Npr. ${defaultObjAddr}` : "Adresa objekta"}
            value={values.adresa_objekta ?? ""}
            onChange={(e) => u("adresa_objekta", e.target.value)}
            data-testid="zahtjev-adresa-objekta"
          />
          <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>
            Ostavi prazno za adresu iz profila firme.
          </div>
        </div>
      </div>
      
      {isVoda && (
        <div className="field-group" style={{ marginBottom: 10 }}>
          <label className="field-label">Ime i prezime kontakt osobe</label>
          <input
            className="input"
            placeholder={company?.direktor_ime ? `Default: ${company.direktor_ime}` : "Ime i prezime"}
            value={values.kontakt_osoba ?? ""}
            onChange={(e) => u("kontakt_osoba", e.target.value)}
            data-testid="zahtjev-kontakt-osoba"
          />
        </div>
      )}
      
      <div style={{ padding: 10, background: "#f0f9ff", borderRadius: 8, fontSize: 11.5, color: "#0c4a6e", marginTop: 6 }}>
        <strong>ℹ️ Auto-popunjeno:</strong> Podnosilac zahtjeva = puni naziv firme · Mjesto podnošenja = adresa firme · Kontakt osoba = direktor · Datum = današnji · Telefon = iz profila firme.
      </div>
    </div>
  );
}


function ExtrasPrijava({ template, values, onChange }) {
  const isZanatstvo = template.filename.toLowerCase().includes("zanatstv");
  const isTrgovina = template.filename.toLowerCase().includes("trgovin");
  const subject = isZanatstvo ? "zanatstva" : "trgovine";
  const subjectSubject = isZanatstvo ? "zanatliji" : "trgovini";
  const subjectActor = isZanatstvo ? "zanatlije" : "trgovca";
  
  const u = (k, v) => onChange({ ...values, [k]: v });
  const tip = values.tip_prijave || "pocetak";
  
  // Datum split (DD/MM/YYYY) — controlled trough three sub-fields
  const dPocetkaParts = (values.datum_pocetka_rada || "").split(".");
  const dPocetkaDay = values.datum_pocetka_day || dPocetkaParts[0] || "";
  const dPocetkaMonth = values.datum_pocetka_month || dPocetkaParts[1] || "";
  const dPocetkaYear = values.datum_pocetka_year || dPocetkaParts[2] || "";
  
  const setDatumPocetka = (day, mo, yr) => {
    const pad = (s, n) => s ? s.toString().padStart(n, "0") : "";
    const combined = (day && mo && yr) ? `${pad(day,2)}.${pad(mo,2)}.${pad(yr,4)}` : "";
    onChange({
      ...values,
      datum_pocetka_day: day,
      datum_pocetka_month: mo,
      datum_pocetka_year: yr,
      datum_pocetka_rada: combined,
    });
  };
  
  // Datum promjene
  const dPromjeneParts = (values.datum_promjene || "").split(".");
  const dPromjeneDay = values.datum_promjene_day || dPromjeneParts[0] || "";
  const dPromjeneMonth = values.datum_promjene_month || dPromjeneParts[1] || "";
  const dPromjeneYear = values.datum_promjene_year || dPromjeneParts[2] || "";
  
  const setDatumPromjene = (day, mo, yr) => {
    const pad = (s, n) => s ? s.toString().padStart(n, "0") : "";
    const combined = (day && mo && yr) ? `${pad(day,2)}.${pad(mo,2)}.${pad(yr,4)}` : "";
    onChange({
      ...values,
      datum_promjene_day: day,
      datum_promjene_month: mo,
      datum_promjene_year: yr,
      datum_promjene: combined,
    });
  };
  
  const today = new Date();
  const todayStr = `${String(today.getDate()).padStart(2,"0")}.${String(today.getMonth()+1).padStart(2,"0")}.${today.getFullYear()}`;
  
  const sectionTitle = (n, txt) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "20px 0 10px 0", paddingBottom: 6, borderBottom: "1px solid var(--border)" }}>
      <div style={{ width: 22, height: 22, borderRadius: 6, background: "#0f172a", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>{n}</div>
      <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text-primary)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{txt}</div>
    </div>
  );
  
  const dateInputStyle = { width: 60, textAlign: "center", padding: "8px 6px" };
  
  return (
    <div style={{ marginTop: 8 }}>
      
      {/* === PREDMET PRIJAVE === */}
      <div className="field-group" style={{ marginBottom: 6 }}>
        <label className="field-label" style={{ textTransform: "uppercase", letterSpacing: "0.05em", fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)" }}>Predmet prijave</label>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
        <button
          type="button"
          onClick={() => u("tip_prijave", "pocetak")}
          data-testid="tip-pocetak"
          style={{
            padding: "14px 12px", borderRadius: 10, cursor: "pointer", fontWeight: 600, fontSize: 13.5,
            border: tip === "pocetak" ? "2px solid #16a34a" : "1px solid var(--border)",
            background: tip === "pocetak" ? "#16a34a" : "white",
            color: tip === "pocetak" ? "white" : "var(--text-primary)",
            transition: "all 150ms",
          }}
        >
          <div style={{ fontSize: 11, opacity: 0.85, marginBottom: 2 }}>1)</div>
          Početak obavljanja
        </button>
        <button
          type="button"
          onClick={() => u("tip_prijave", "promjena")}
          data-testid="tip-promjena"
          style={{
            padding: "14px 12px", borderRadius: 10, cursor: "pointer", fontWeight: 600, fontSize: 13.5,
            border: tip === "promjena" ? "2px solid #ca8a04" : "1px solid var(--border)",
            background: tip === "promjena" ? "#eab308" : "white",
            color: tip === "promjena" ? "white" : "var(--text-primary)",
            transition: "all 150ms",
          }}
        >
          <div style={{ fontSize: 11, opacity: 0.85, marginBottom: 2 }}>2)</div>
          Promjena podataka
        </button>
      </div>
      
      {/* === SECTION 1 — Podaci o (trgovcu / zanatliji) === */}
      {sectionTitle("1", `Podaci o ${subjectActor}`)}
      <div style={{ padding: 10, background: "#f8fafc", borderRadius: 8, fontSize: 12, color: "var(--text-secondary)", marginBottom: 10 }}>
        <strong>Auto-popunjavanje iz klijenta</strong> — naziv/ime, sjedište, broj rješenja, šifra djelatnosti, ovlašćeno lice + JMBG, žiro račun, PIB, telefon. Možete dopuniti niže ako fali.
      </div>
      
      {/* === SECTION 2 — Podaci o (trgovini / zanatstvu) === */}
      {sectionTitle("2", `Podaci o ${subject}`)}
      
      {isTrgovina && (
        <div className="field-group" style={{ marginBottom: 12 }}>
          <label className="field-label">Vrsta trgovine</label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {[
              { v: "malo", l: "Trgovina na malo" },
              { v: "veliko", l: "Trgovina na veliko" },
              { v: "distanciona", l: "Distanciona" },
              { v: "usluge", l: "Trgovinske usluge" },
            ].map(opt => (
              <label key={opt.v} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 8, border: values.vrsta_trgovine === opt.v ? "2px solid #0f172a" : "1px solid var(--border)", cursor: "pointer", background: values.vrsta_trgovine === opt.v ? "#f1f5f9" : "white", fontSize: 13 }}>
                <input
                  type="radio"
                  name="vrsta_trgovine"
                  value={opt.v}
                  checked={values.vrsta_trgovine === opt.v}
                  onChange={(e) => u("vrsta_trgovine", e.target.value)}
                  data-testid={`vrsta-trgovine-${opt.v}`}
                />
                {opt.l}
              </label>
            ))}
          </div>
        </div>
      )}
      
      <div className="field-group" style={{ marginBottom: 12 }}>
        <label className="field-label">{isZanatstvo ? "Vrsta zanata / aktiviteti" : "Vrsta robe / trgovinske usluge *"}</label>
        <input
          className="input"
          placeholder={isZanatstvo ? "Npr. Frizerski salon, Servis, Krojač..." : "Npr. mješovita roba, tekstil, obuća..."}
          value={values[isZanatstvo ? "vrsta_zanata" : "vrsta_robe"] || ""}
          onChange={(e) => u(isZanatstvo ? "vrsta_zanata" : "vrsta_robe", e.target.value)}
          data-testid="vrsta-robe-input"
        />
      </div>
      
      {/* === SECTION 3 — Podaci o poslovnoj prostoriji === */}
      {sectionTitle("3", "Podaci o posl. prostoriji")}
      
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
        <div className="field-group">
          <label className="field-label">Sjedište (grad)</label>
          <input
            className="input"
            placeholder="Ulcinj"
            value={values[isZanatstvo ? "sjediste_zanatstva" : "sjediste_objekta"] || ""}
            onChange={(e) => u(isZanatstvo ? "sjediste_zanatstva" : "sjediste_objekta", e.target.value)}
            data-testid="sjediste-objekta"
          />
        </div>
        <div className="field-group">
          <label className="field-label">Adresa prostorije</label>
          <input
            className="input"
            placeholder="Ulica i broj"
            value={values[isZanatstvo ? "adresa_zanatstva" : "adresa_objekta"] || ""}
            onChange={(e) => u(isZanatstvo ? "adresa_zanatstva" : "adresa_objekta", e.target.value)}
            data-testid="adresa-objekta"
          />
        </div>
      </div>
      
      {isTrgovina && (
        <div className="field-group" style={{ marginBottom: 10 }}>
          <label className="field-label">Naziv objekta (opciono)</label>
          <input
            className="input"
            placeholder="Npr. Mini Market BLOK"
            value={values.naziv_objekta || ""}
            onChange={(e) => u("naziv_objekta", e.target.value)}
            data-testid="naziv-objekta"
          />
        </div>
      )}
      
      {/* Vrsta prostorije + m² grid (samo trgovina) */}
      {isTrgovina && (
        <>
          <div className="field-group" style={{ marginBottom: 6 }}>
            <label className="field-label">Vrsta prostorije i površina (m²)</label>
          </div>
          <div style={{ display: "grid", gap: 6, marginBottom: 12 }}>
            {[
              { k: "m2_prodavnica", l: "Prodavnica" },
              { k: "m2_skladiste", l: "Skladište" },
              { k: "m2_stovariste", l: "Stovarište" },
              { k: "m2_drugo", l: "Drugo prodajno mjesto" },
              { k: "m2_usluge_prostor", l: "Prostorija za trgovinske usluge" },
              { k: "m2_pijaca", l: "Pijaca i dr. prostori" },
            ].map(opt => {
              const checked = !!values[opt.k];
              return (
                <div key={opt.k} style={{ display: "grid", gridTemplateColumns: "24px 1fr 100px 30px", gap: 8, alignItems: "center", padding: "6px 10px", borderRadius: 6, background: checked ? "#f1f5f9" : "transparent" }}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => u(opt.k, e.target.checked ? (values[opt.k] || "1") : "")}
                    data-testid={`chk-${opt.k}`}
                  />
                  <div style={{ fontSize: 13 }}>{opt.l}</div>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    placeholder="m²"
                    value={values[opt.k] || ""}
                    onChange={(e) => u(opt.k, e.target.value)}
                    style={{ padding: "6px 8px" }}
                    data-testid={`m2-${opt.k}`}
                  />
                  <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>m²</div>
                </div>
              );
            })}
          </div>
          
          <div className="field-group" style={{ marginBottom: 14 }}>
            <label className="field-label">Lokacija prostorije</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              {[
                { v: "zatvor", l: "U zatvorenom prostoru" },
                { v: "otvoren", l: "Na otvorenom prostoru" },
                { v: "pijac", l: "Na pijaci" },
              ].map(opt => (
                <label key={opt.v} style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 12px", borderRadius: 8, border: values.lokacija === opt.v ? "2px solid #0f172a" : "1px solid var(--border)", cursor: "pointer", background: values.lokacija === opt.v ? "#f1f5f9" : "white", fontSize: 12.5 }}>
                  <input
                    type="radio"
                    name="lokacija"
                    value={opt.v}
                    checked={values.lokacija === opt.v}
                    onChange={(e) => u("lokacija", e.target.value)}
                    data-testid={`lokacija-${opt.v}`}
                  />
                  {opt.l}
                </label>
              ))}
            </div>
          </div>
        </>
      )}
      
      {/* === ZANATSTVO m² fields === */}
      {isZanatstvo && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
          <div className="field-group">
            <label className="field-label">Poslovni prostor (m²)</label>
            <input
              className="input"
              type="number"
              min="0"
              placeholder="Npr. 35"
              value={values.m2_poslovni || ""}
              onChange={(e) => u("m2_poslovni", e.target.value)}
              data-testid="m2-poslovni"
            />
          </div>
          <div className="field-group">
            <label className="field-label">Stambeni prostor (m²) — opciono</label>
            <input
              className="input"
              type="number"
              min="0"
              placeholder="0"
              value={values.m2_stambeni || ""}
              onChange={(e) => u("m2_stambeni", e.target.value)}
              data-testid="m2-stambeni"
            />
          </div>
        </div>
      )}
      
      {/* === SECTION 5-8 — DATUMI === */}
      {sectionTitle("5-8", "Datumi")}
      
      <div className="field-group" style={{ marginBottom: 14 }}>
        <label className="field-label">Datum početka rada</label>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input className="input" type="number" min="1" max="31" placeholder="DD" value={dPocetkaDay} onChange={(e) => setDatumPocetka(e.target.value, dPocetkaMonth, dPocetkaYear)} style={dateInputStyle} data-testid="dp-day" />
          <span style={{ color: "var(--text-tertiary)" }}>.</span>
          <input className="input" type="number" min="1" max="12" placeholder="MM" value={dPocetkaMonth} onChange={(e) => setDatumPocetka(dPocetkaDay, e.target.value, dPocetkaYear)} style={dateInputStyle} data-testid="dp-month" />
          <span style={{ color: "var(--text-tertiary)" }}>.</span>
          <input className="input" type="number" min="2020" max="2099" placeholder="YYYY" value={dPocetkaYear} onChange={(e) => setDatumPocetka(dPocetkaDay, dPocetkaMonth, e.target.value)} style={{ ...dateInputStyle, width: 80 }} data-testid="dp-year" />
          <span style={{ fontSize: 12, color: "var(--text-tertiary)", marginLeft: 8 }}>
            {values.datum_pocetka_rada ? `→ ${values.datum_pocetka_rada}` : "Format: DD . MM . YYYY"}
          </span>
        </div>
      </div>
      
      <div className="field-group" style={{ marginBottom: 6 }}>
        <label className="field-label">Datum podnošenja prijave</label>
        <input className="input" value={todayStr} disabled readOnly style={{ background: "#f3f4f6", maxWidth: 200 }} data-testid="datum-podnosenja" />
        <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>Današnji datum (automatski)</div>
      </div>
      
      {/* === Vrsta promjene — samo ako je tip = promjena === */}
      {tip === "promjena" && (
        <>
          <div className="field-group" style={{ marginTop: 14 }}>
            <label className="field-label">Vrsta i opis promjene</label>
            <textarea
              className="input"
              rows={2}
              placeholder="Npr. promjena adrese, promjena djelatnosti..."
              value={values.opis_promjene || ""}
              onChange={(e) => u("opis_promjene", e.target.value)}
              data-testid="opis-promjene"
            />
          </div>
          <div className="field-group" style={{ marginTop: 10 }}>
            <label className="field-label">Datum nastanka promjene</label>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input className="input" type="number" min="1" max="31" placeholder="DD" value={dPromjeneDay} onChange={(e) => setDatumPromjene(e.target.value, dPromjeneMonth, dPromjeneYear)} style={dateInputStyle} data-testid="dpr-day" />
              <span style={{ color: "var(--text-tertiary)" }}>.</span>
              <input className="input" type="number" min="1" max="12" placeholder="MM" value={dPromjeneMonth} onChange={(e) => setDatumPromjene(dPromjeneDay, e.target.value, dPromjeneYear)} style={dateInputStyle} data-testid="dpr-month" />
              <span style={{ color: "var(--text-tertiary)" }}>.</span>
              <input className="input" type="number" min="2020" max="2099" placeholder="YYYY" value={dPromjeneYear} onChange={(e) => setDatumPromjene(dPromjeneDay, dPromjeneMonth, e.target.value)} style={{ ...dateInputStyle, width: 80 }} data-testid="dpr-year" />
              {values.datum_promjene && <span style={{ fontSize: 12, color: "var(--text-tertiary)", marginLeft: 8 }}>→ {values.datum_promjene}</span>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function DocumentsHistory({ history, loading, companies, filter, setFilter, onOpen, onDelete }) {
  const fmtDate = (iso) => {
    if (!iso) return "—";
    try {
      const d = new Date(iso);
      return d.toLocaleString("sr-Latn", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch { return iso.slice(0, 16).replace("T", " "); }
  };
  
  const tplLabel = (fn) => {
    if (!fn) return "?";
    return fn.replace(/\.(docx|pdf)$/i, "").replace(/_/g, " ");
  };

  if (loading) {
    return <div className="empty"><Spinner size={28} className="spin" /></div>;
  }

  return (
    <div data-testid="documents-history">
      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <select
          className="select"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{ minWidth: 260 }}
          data-testid="history-company-filter"
        >
          <option value="">Sve firme ({history.length} ukupno)</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>{c.naziv_skraceni || c.naziv}</option>
          ))}
        </select>
        <div style={{ fontSize: 12.5, color: "var(--text-tertiary)" }}>
          Klikni na zapis da ga otvoriš i napraviš "Promjenu podataka"
        </div>
      </div>

      {history.length === 0 ? (
        <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-tertiary)", fontSize: 13, border: "1px dashed var(--border)", borderRadius: 8 }}>
          Još nije generisana nijedna prijava. Generiši prvi dokument iz tab-a "Šabloni".
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "1px solid var(--border)" }}>
                <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600, color: "var(--text-tertiary)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em" }}>Datum</th>
                <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600, color: "var(--text-tertiary)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em" }}>Firma</th>
                <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600, color: "var(--text-tertiary)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em" }}>Prijava / Dokument</th>
                <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600, color: "var(--text-tertiary)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em" }}>Tip</th>
                <th style={{ padding: "10px 12px", textAlign: "right", fontWeight: 600, color: "var(--text-tertiary)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em" }}>Akcije</th>
              </tr>
            </thead>
            <tbody>
              {history.map((rec) => {
                const tip = (rec.custom_fields?.tip_prijave || "").toLowerCase();
                const tipLabel = tip === "promjena" ? "Promjena" : (tip === "pocetak" ? "Početak" : "—");
                const fname = rec.template_filename || rec.template || "";
                const isForm = fname.toLowerCase().includes("prijava");
                return (
                  <tr key={rec.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "10px 12px", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>{fmtDate(rec.created_at)}</td>
                    <td style={{ padding: "10px 12px", fontWeight: 600, color: "var(--text-primary)" }}>{rec.company_naziv || "—"}</td>
                    <td style={{ padding: "10px 12px", color: "var(--text-secondary)" }}>{tplLabel(fname)}</td>
                    <td style={{ padding: "10px 12px" }}>
                      {tip && (
                        <span className={`badge ${tip === "promjena" ? "badge-warning" : "badge-success"}`} style={{ fontSize: 11 }}>
                          {tipLabel}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", whiteSpace: "nowrap" }}>
                      <div style={{ display: "inline-flex", gap: 4 }}>
                        <a
                          href={`${API}/documents/preview/${rec.pdf_filename || rec.filename}?token=${getToken()}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-secondary btn-sm"
                          title="Otvori PDF za štampu"
                          data-testid={`history-print-${rec.id}`}
                        >
                          <Printer size={13} />
                        </a>
                        <a
                          href={`${API}/documents/download/${rec.filename || rec.pdf_filename}?token=${getToken()}`}
                          className="btn btn-secondary btn-sm"
                          title="Preuzmi"
                          data-testid={`history-download-${rec.id}`}
                        >
                          <DownloadSimple size={13} />
                        </a>
                        {isForm && (
                          <button
                            type="button"
                            onClick={() => onOpen(rec)}
                            className="btn btn-primary btn-sm"
                            title="Otvori i napravi promjenu podataka"
                            data-testid={`history-edit-${rec.id}`}
                          >
                            <PencilSimple size={13} /> Promjena
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onDelete(rec.id)}
                          className="btn btn-secondary btn-sm"
                          style={{ color: "#dc2626" }}
                          title="Obriši zapis"
                          data-testid={`history-delete-${rec.id}`}
                        >
                          <Trash size={13} />
                        </button>
                      </div>
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
