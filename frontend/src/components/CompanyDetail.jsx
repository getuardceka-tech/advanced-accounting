import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  CaretLeft, Plus, PencilSimple, Trash, X, Check, Spinner, FileText,
  Users, Buildings, DownloadSimple, Printer,
} from "@phosphor-icons/react";
import api, { getToken, API } from "@/lib/api";

const escapeHtmlDoc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]));

function printDocsReport(company, docs) {
  if (!docs || docs.length === 0) return;
  const now = new Date();
  const dateStr = now.toLocaleDateString("sr-Latn", { day: "2-digit", month: "2-digit", year: "numeric" });
  const timeStr = now.toLocaleTimeString("sr-Latn", { hour: "2-digit", minute: "2-digit" });
  const esc = escapeHtmlDoc;
  
  // Sortiraj po datumu opadajuće (najnoviji prvi)
  const sorted = [...docs].sort((a, b) => (new Date(b.created_at)) - (new Date(a.created_at)));
  
  // Grupiši po mjesecu
  const groups = {};
  const monthNames = ["Januar","Februar","Mart","April","Maj","Jun","Jul","Avgust","Septembar","Oktobar","Novembar","Decembar"];
  sorted.forEach((d) => {
    const dt = new Date(d.created_at);
    const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
    const label = `${monthNames[dt.getMonth()]} ${dt.getFullYear()}`;
    if (!groups[key]) groups[key] = { label, items: [] };
    groups[key].items.push(d);
  });
  const groupKeys = Object.keys(groups).sort().reverse();
  
  const cleanTemplate = (t) => (t || "").replace(/\.[^.]+$/, "");
  
  const rowsHtml = groupKeys.map((k) => {
    const g = groups[k];
    const rows = g.items.map((d, i) => {
      const dt = new Date(d.created_at);
      const dateFmt = dt.toLocaleDateString("sr-Latn", { day: "2-digit", month: "2-digit", year: "numeric" });
      const timeFmt = dt.toLocaleTimeString("sr-Latn", { hour: "2-digit", minute: "2-digit" });
      return `<tr>
        <td class="c mono">${i + 1}</td>
        <td class="mono">${esc(dateFmt)} <span class="sub">${esc(timeFmt)}</span></td>
        <td><div class="nm">${esc(cleanTemplate(d.template))}</div></td>
        <td>${esc(d.employee_naziv || "—")}</td>
        <td class="mono sub">${esc(d.filename || "")}</td>
      </tr>`;
    }).join("");
    return `<tr class="group"><td colspan="5">📅 ${esc(g.label)} · ${g.items.length} ${g.items.length === 1 ? "dokument" : "dokumenata"}</td></tr>${rows}`;
  }).join("");
  
  const html = `<!DOCTYPE html>
<html lang="sr">
<head>
<meta charset="UTF-8">
<title>Izvještaj generisanih dokumenata - ${esc(company?.naziv_skraceni || company?.naziv || "")}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 32px 28px; color: #0f172a; margin: 0; font-size: 12px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 16px; border-bottom: 2px solid #0f172a; margin-bottom: 18px; }
  .brand { display: flex; align-items: center; gap: 12px; }
  .logo { width: 44px; height: 44px; border-radius: 10px; background: #0f172a; color: white; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 18px; letter-spacing: -0.5px; }
  .brand-name { font-size: 15px; font-weight: 700; }
  .brand-sub { font-size: 10.5px; color: #64748b; margin-top: 2px; text-transform: uppercase; letter-spacing: 0.5px; }
  .meta { text-align: right; font-size: 11px; color: #64748b; }
  .meta .date { font-weight: 600; color: #0f172a; font-size: 12px; }
  h1 { font-size: 20px; margin: 0 0 4px; font-weight: 700; letter-spacing: -0.4px; }
  .subtitle { font-size: 12px; color: #64748b; margin-bottom: 4px; }
  .company-box { background: #f8fafc; border-left: 3px solid #0f172a; padding: 10px 14px; margin: 12px 0 16px; font-size: 12px; }
  .company-box .cn { font-weight: 700; font-size: 13px; color: #0f172a; }
  .company-box .cm { color: #64748b; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  thead { background: #f1f5f9; }
  th { padding: 8px 8px; text-align: left; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #475569; border-bottom: 1.5px solid #cbd5e1; }
  td { padding: 7px 8px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
  td.c { text-align: center; width: 32px; }
  td.mono { font-family: "JetBrains Mono", Consolas, monospace; font-size: 10.5px; }
  .nm { font-weight: 600; color: #0f172a; }
  .sub { color: #94a3b8; font-size: 10px; }
  tr.group td { background: #eff6ff; color: #1e40af; font-weight: 700; font-size: 11.5px; padding: 9px 10px; border-bottom: 1.5px solid #bfdbfe; border-top: 1.5px solid #bfdbfe; letter-spacing: 0.2px; }
  .footer { margin-top: 20px; padding-top: 12px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 10.5px; color: #64748b; }
  .no-print { position: fixed; top: 12px; right: 12px; z-index: 999; }
  .btn { padding: 8px 18px; font-size: 13px; font-weight: 600; border: none; border-radius: 6px; cursor: pointer; background: #0f172a; color: white; box-shadow: 0 2px 8px rgba(0,0,0,0.15); }
  .stats { display: flex; gap: 12px; margin: 14px 0 18px; }
  .stat { flex: 1; padding: 10px 14px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; }
  .stat-label { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; }
  .stat-value { font-size: 18px; font-weight: 700; color: #0f172a; margin-top: 4px; }
  @media print {
    body { padding: 16px 12px; }
    .no-print { display: none !important; }
    thead { display: table-header-group; }
    tr.group { page-break-before: auto; }
    tr { page-break-inside: avoid; }
  }
  @page { size: A4 portrait; margin: 14mm; }
</style>
</head>
<body>
  <div class="no-print"><button class="btn" onclick="window.print()">🖨️ Štampaj</button></div>
  <div class="header">
    <div class="brand">
      <div class="logo">AA</div>
      <div>
        <div class="brand-name">Advanced Accounting</div>
        <div class="brand-sub">Agencija za računovodstvo · Ulcinj</div>
      </div>
    </div>
    <div class="meta">
      <div class="date">${dateStr} · ${timeStr}</div>
      <div>Period: <strong>svi dokumenti</strong></div>
    </div>
  </div>
  <h1>Izvještaj generisanih dokumenata</h1>
  <div class="subtitle">Hronološki pregled svih ugovora, odluka i akata generisanih za klijenta</div>
  <div class="company-box">
    <div class="cn">${esc(company?.naziv || "—")}</div>
    <div class="cm">PIB: ${esc(company?.pib || "—")}${company?.adresa ? ` · ${esc(company.adresa)}` : ""}${company?.grad ? `, ${esc(company.grad)}` : ""}</div>
  </div>
  <div class="stats">
    <div class="stat"><div class="stat-label">Ukupno dokumenata</div><div class="stat-value">${docs.length}</div></div>
    <div class="stat"><div class="stat-label">Mjeseci sa aktivnošću</div><div class="stat-value">${groupKeys.length}</div></div>
    <div class="stat"><div class="stat-label">Prvi dokument</div><div class="stat-value" style="font-size:13px;font-weight:600">${esc(new Date(sorted[sorted.length-1].created_at).toLocaleDateString("sr-Latn", { day: "2-digit", month: "2-digit", year: "numeric" }))}</div></div>
    <div class="stat"><div class="stat-label">Posljednji dokument</div><div class="stat-value" style="font-size:13px;font-weight:600">${esc(new Date(sorted[0].created_at).toLocaleDateString("sr-Latn", { day: "2-digit", month: "2-digit", year: "numeric" }))}</div></div>
  </div>
  <table>
    <thead>
      <tr>
        <th class="c">#</th>
        <th style="width:110px">Datum / Vrijeme</th>
        <th>Vrsta dokumenta</th>
        <th style="width:180px">Zaposleni / lice</th>
        <th style="width:180px">Fajl</th>
      </tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
  </table>
  <div class="footer">
    <div>Generisano iz Advanced Accounting sistema</div>
    <div>${dateStr} · ${timeStr}</div>
  </div>
  <script>window.addEventListener('load', function() { setTimeout(function(){ window.print(); }, 300); });</script>
</body>
</html>`;
  
  const w = window.open("", "_blank", "width=1000,height=800");
  if (!w) {
    alert("Molimo omogućite pop-up prozore da biste odštampali izvještaj.");
    return;
  }
  w.document.write(html);
  w.document.close();
}

const empEmpty = {
  objekat_id: "",
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
  const [objekti, setObjekti] = useState([]);
  const [docs, setDocs] = useState([]);
  const [empModalOpen, setEmpModalOpen] = useState(false);
  const [empForm, setEmpForm] = useState(empEmpty);
  const [editingEmp, setEditingEmp] = useState(null);
  const [empSaving, setEmpSaving] = useState(false);
  const [empError, setEmpError] = useState("");

  const load = async () => {
    try {
      const [c, e, d, o] = await Promise.all([
        api.get(`/companies/${id}`),
        api.get(`/employees?company_id=${id}`),
        api.get(`/documents?company_id=${id}`),
        api.get(`/companies/${id}/objekti`),
      ]);
      setCompany(c.data);
      setEmployees(e.data);
      setDocs(d.data);
      // samo ručno-sačuvani objekti (saved=true)
      setObjekti((o.data || []).filter((x) => x.saved));
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
          { id: "zaposleni", label: `Zaposleni (${employees.filter((e) => e.status !== "arhiva").length})`, icon: Users },
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
        <ZaposleniTab
          company={company}
          employees={employees}
          openEmpCreate={openEmpCreate}
          openEmpEdit={openEmpEdit}
          removeEmp={removeEmp}
        />
      )}

      {tab === "dokumenti" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14, alignItems: "center" }}>
            <div style={{ fontSize: 13, color: "var(--text-tertiary)" }}>
              {docs.length} dokumenata generisano za ovu firmu
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                className="btn btn-secondary"
                onClick={() => printDocsReport(company, docs)}
                data-testid="print-docs-btn"
                title="Štampaj izvještaj svih dokumenata"
                disabled={docs.length === 0}
              >
                <Printer size={14} /> Štampaj izvještaj
              </button>
              <button className="btn btn-primary" onClick={() => navigate(`/dokumenti?company=${id}`)} data-testid="generate-doc-btn">
                <FileText size={14} /> Generiši dokument
              </button>
            </div>
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
          objekti={objekti}
          onSave={saveEmp}
          onClose={() => setEmpModalOpen(false)}
          saving={empSaving}
          error={empError}
        />
      )}
    </div>
  );
}

function ZaposleniTab({ company, employees, openEmpCreate, openEmpEdit, removeEmp }) {
  const [sub, setSub] = useState("aktivni");
  const active = employees.filter((e) => e.status !== "arhiva");
  const arhiva = employees.filter((e) => e.status === "arhiva");
  const list = sub === "aktivni" ? active : arhiva;
  
  const reasonBadge = (r) => {
    if (r === "prestanak") return { label: "Prestanak radnog odnosa", bg: "#fee2e2", color: "#991b1b" };
    if (r === "istekao") return { label: "Istekao ugovor", bg: "#fef3c7", color: "#92400e" };
    if (r === "deaktiviran") return { label: "Deaktiviran", bg: "#e2e8f0", color: "#475569" };
    return { label: "Aktivan", bg: "#dcfce7", color: "#166534" };
  };
  const fmtDate = (iso) => {
    if (!iso) return "—";
    try {
      const dt = new Date(iso);
      return dt.toLocaleDateString("sr-Latn", { day: "2-digit", month: "2-digit", year: "numeric" });
    } catch { return iso; }
  };
  
  const handlePrint = () => {
    const now = new Date();
    const dateStr = now.toLocaleDateString("sr-Latn", { day: "2-digit", month: "2-digit", year: "numeric" });
    const timeStr = now.toLocaleTimeString("sr-Latn", { hour: "2-digit", minute: "2-digit" });
    const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]));
    const subLabel = sub === "aktivni" ? "Aktivni zaposleni" : "Prestanak radnog odnosa / Istekli ugovori";
    
    const isArhiva = sub === "arhiva";
    const headers = isArhiva
      ? ["#", "Ime i prezime", "JMBG", "Objekat", "Pozicija", "Ugovor", "Datum početka", "Status / Datum"]
      : ["#", "Ime i prezime", "JMBG", "Objekat", "Pozicija", "Ugovor", "Datum početka", "Radno vrijeme"];
    
    const rows = list.map((e, i) => {
      const b = reasonBadge(e.arhiva_reason);
      const lastCol = isArhiva
        ? `<div style="font-weight:600;color:${b.color}">${esc(b.label)}</div>${e.arhiva_date ? `<div class="sub">${esc(fmtDate(e.arhiva_date))}</div>` : ""}`
        : (e.radno_vrijeme === "puno" ? "Puno (40h)" : (e.sati_sedmicno ? `${e.sati_sedmicno}h/nedj.` : "Skraćeno"));
      return `<tr>
        <td class="c">${i + 1}</td>
        <td>
          <div class="nm">${esc(e.ime || "")} ${esc(e.prezime || "")}</div>
          ${e.adresa ? `<div class="sub">${esc(e.adresa)}</div>` : ""}
        </td>
        <td class="mono">${esc(e.jmbg || "—")}</td>
        <td>${e.objekat_naziv ? esc(e.objekat_naziv) : "<span class=\"muted\">—</span>"}</td>
        <td>${esc(e.pozicija || "—")}</td>
        <td>${e.vrsta_ugovora === "neodredjeno" ? "Neodređeno" : "Određeno"}</td>
        <td class="mono">${esc(fmtDate(e.datum_pocetka))}</td>
        <td>${lastCol}</td>
      </tr>`;
    }).join("");
    
    const html = `<!DOCTYPE html>
<html lang="sr">
<head>
<meta charset="UTF-8">
<title>Spisak zaposlenih - ${esc(company?.naziv_skraceni || company?.naziv || "")}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 32px 28px; color: #0f172a; margin: 0; font-size: 12px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 16px; border-bottom: 2px solid #0f172a; margin-bottom: 18px; }
  .brand { display: flex; align-items: center; gap: 12px; }
  .logo { width: 44px; height: 44px; border-radius: 10px; background: #0f172a; color: white; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 18px; letter-spacing: -0.5px; }
  .brand-name { font-size: 15px; font-weight: 700; }
  .brand-sub { font-size: 10.5px; color: #64748b; margin-top: 2px; text-transform: uppercase; letter-spacing: 0.5px; }
  .meta { text-align: right; font-size: 11px; color: #64748b; }
  .meta .date { font-weight: 600; color: #0f172a; font-size: 12px; }
  h1 { font-size: 20px; margin: 0 0 4px; font-weight: 700; letter-spacing: -0.4px; }
  .subtitle { font-size: 12px; color: #64748b; margin-bottom: 4px; }
  .company-box { background: #f8fafc; border-left: 3px solid #0f172a; padding: 10px 14px; margin: 12px 0 16px; font-size: 12px; }
  .company-box .cn { font-weight: 700; font-size: 13px; color: #0f172a; }
  .company-box .cm { color: #64748b; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  thead { background: #f1f5f9; }
  th { padding: 8px 8px; text-align: left; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #475569; border-bottom: 1.5px solid #cbd5e1; }
  td { padding: 8px 8px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
  td.c { text-align: center; }
  td.mono { font-family: "JetBrains Mono", Consolas, monospace; font-size: 10.5px; }
  .nm { font-weight: 600; color: #0f172a; }
  .sub { font-size: 10px; color: #64748b; margin-top: 2px; }
  .muted { color: #94a3b8; }
  tbody tr:nth-child(even) { background: #fafbfc; }
  .footer { margin-top: 20px; padding-top: 12px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 10.5px; color: #64748b; }
  .no-print { position: fixed; top: 12px; right: 12px; z-index: 999; }
  .btn { padding: 8px 18px; font-size: 13px; font-weight: 600; border: none; border-radius: 6px; cursor: pointer; background: #0f172a; color: white; box-shadow: 0 2px 8px rgba(0,0,0,0.15); }
  @media print {
    body { padding: 16px 12px; }
    .no-print { display: none !important; }
    thead { display: table-header-group; }
    tr { page-break-inside: avoid; }
  }
  @page { size: A4 landscape; margin: 14mm; }
</style>
</head>
<body>
  <div class="no-print"><button class="btn" onclick="window.print()">🖨️ Štampaj</button></div>
  <div class="header">
    <div class="brand">
      <div class="logo">AA</div>
      <div>
        <div class="brand-name">Advanced Accounting</div>
        <div class="brand-sub">Agencija za računovodstvo · Ulcinj</div>
      </div>
    </div>
    <div class="meta">
      <div class="date">${dateStr} · ${timeStr}</div>
      <div>Ukupno: <strong>${list.length}</strong> ${list.length === 1 ? "zaposleni" : "zaposlenih"}</div>
    </div>
  </div>
  <h1>Spisak zaposlenih</h1>
  <div class="subtitle">${esc(subLabel)}</div>
  <div class="company-box">
    <div class="cn">${esc(company?.naziv || "—")}</div>
    <div class="cm">PIB: ${esc(company?.pib || "—")}${company?.adresa ? ` · ${esc(company.adresa)}` : ""}${company?.grad ? `, ${esc(company.grad)}` : ""}</div>
  </div>
  <table>
    <thead>
      <tr>${headers.map((h, i) => `<th${i === 0 ? ' style="width:32px"' : ""}>${esc(h)}</th>`).join("")}</tr>
    </thead>
    <tbody>${rows || `<tr><td colspan="${headers.length}" style="text-align:center;padding:24px;color:#94a3b8">Nema zaposlenih za prikaz</td></tr>`}</tbody>
  </table>
  <div class="footer">
    <div>Generisano iz Advanced Accounting sistema</div>
    <div>${dateStr} · ${timeStr}</div>
  </div>
  <script>window.addEventListener('load', function() { setTimeout(function(){ window.print(); }, 300); });</script>
</body>
</html>`;
    
    const w = window.open("", "_blank", "width=1200,height=800");
    if (!w) {
      alert("Molimo omogućite pop-up prozore da biste odštampali spisak.");
      return;
    }
    w.document.write(html);
    w.document.close();
  };
  
  return (
    <div>
      {/* Sub-tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14, background: "#f8fafc", padding: 4, borderRadius: 8, width: "fit-content", border: "1px solid var(--border)" }}>
        {[
          { v: "aktivni", l: `Aktivni (${active.length})`, c: "#10b981" },
          { v: "arhiva", l: `Prestanak / Istekli (${arhiva.length})`, c: "#ef4444" },
        ].map((s) => (
          <button
            key={s.v}
            onClick={() => setSub(s.v)}
            data-testid={`sub-tab-${s.v}`}
            style={{
              padding: "6px 14px", borderRadius: 6, border: "none",
              background: sub === s.v ? "white" : "transparent",
              color: sub === s.v ? s.c : "var(--text-secondary)",
              cursor: "pointer", fontSize: 12.5, fontWeight: sub === s.v ? 600 : 500,
              boxShadow: sub === s.v ? "0 1px 3px rgba(0,0,0,0.06)" : "none",
              transition: "all 0.15s",
            }}
          >
            {s.l}
          </button>
        ))}
      </div>
      
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14, alignItems: "center" }}>
        <div style={{ fontSize: 13, color: "var(--text-tertiary)" }}>
          {list.length} {list.length === 1 ? "zaposleni" : "zaposlenih"}
          {sub === "arhiva" && arhiva.length > 0 && (
            <span style={{ marginLeft: 8, fontSize: 11.5 }}>· Zaposlenima kojima je istekao ugovor ili je prestao radni odnos.</span>
          )}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary" onClick={handlePrint} data-testid="print-employees-btn" title="Štampaj / sačuvaj kao PDF" disabled={list.length === 0}>
            <Printer size={14} /> Štampaj spisak
          </button>
          {sub === "aktivni" && (
            <button className="btn btn-primary" onClick={openEmpCreate} data-testid="add-employee-btn">
              <Plus size={14} /> Dodaj zaposlenog
            </button>
          )}
        </div>
      </div>
      
      {list.length === 0 ? (
        <div className="empty">
          <div className="empty-icon"><Users size={24} /></div>
          <div className="empty-title">
            {sub === "aktivni" ? "Nema unijetih zaposlenih" : "Nema zaposlenih u arhivi"}
          </div>
          <div className="empty-text">
            {sub === "aktivni"
              ? "Dodajte zaposlene da možete brže generisati ugovore i odluke."
              : "Ovdje se automatski pojavljuju zaposleni kojima je istekao ugovor ili im je prestao radni odnos."}
          </div>
          {sub === "aktivni" && (
            <button className="btn btn-primary" onClick={openEmpCreate}>
              <Plus size={14} /> Dodaj prvog zaposlenog
            </button>
          )}
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Ime i prezime</th>
                <th>JMBG</th>
                <th>Objekat</th>
                <th>Pozicija</th>
                <th>Plata (€)</th>
                <th>Ugovor</th>
                {sub === "arhiva" && <th>Status / Datum</th>}
                <th style={{ width: 80 }}></th>
              </tr>
            </thead>
            <tbody>
              {list.map((e) => {
                const b = reasonBadge(e.arhiva_reason);
                return (
                  <tr key={e.id} data-testid={`employee-row-${e.id}`}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{e.ime} {e.prezime}</div>
                      {e.adresa && <div style={{ fontSize: 11.5, color: "var(--text-tertiary)" }}>{e.adresa}</div>}
                    </td>
                    <td style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 12.5 }}>{e.jmbg || "—"}</td>
                    <td style={{ fontSize: 12 }}>
                      {e.objekat_naziv ? (
                        <span style={{ display: "inline-block", padding: "2px 8px", background: "#dbeafe", color: "#1e40af", borderRadius: 10, fontSize: 11.5, fontWeight: 500 }}>
                          {e.objekat_naziv}
                        </span>
                      ) : <span style={{ color: "var(--text-tertiary)" }}>—</span>}
                    </td>
                    <td style={{ fontSize: 12.5 }}>{e.pozicija || "—"}</td>
                    <td style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 12.5 }}>
                      {e.plata_bruto ? `${e.plata_bruto.toFixed(2)}` : "—"}
                    </td>
                    <td>
                      <span className="badge badge-neutral">{e.vrsta_ugovora === "neodredjeno" ? "Neodređeno" : "Određeno"}</span>
                    </td>
                    {sub === "arhiva" && (
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                          <span style={{ display: "inline-block", padding: "2px 8px", background: b.bg, color: b.color, borderRadius: 10, fontSize: 11, fontWeight: 600, width: "fit-content" }}>
                            {b.label}
                          </span>
                          {e.arhiva_date && (
                            <span style={{ fontSize: 11.5, color: "var(--text-tertiary)" }}>{fmtDate(e.arhiva_date)}</span>
                          )}
                        </div>
                      </td>
                    )}
                    <td>
                      <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                        <button onClick={() => openEmpEdit(e)} style={{ border: "none", background: "transparent", padding: 5, borderRadius: 4, color: "var(--text-secondary)", cursor: "pointer", display: "flex" }} title="Uredi">
                          <PencilSimple size={15} />
                        </button>
                        <button onClick={() => removeEmp(e)} style={{ border: "none", background: "transparent", padding: 5, borderRadius: 4, color: "var(--danger-text)", cursor: "pointer", display: "flex" }} title="Obriši">
                          <Trash size={15} />
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

function EmployeeModal({ form, setForm, editing, objekti = [], onSave, onClose, saving, error }) {
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
          {objekti.length > 0 && (
            <div className="field-group" style={{ marginBottom: 14 }}>
              <label className="field-label">Objekat (poslovnica)</label>
              <select className="select" value={form.objekat_id || ""} onChange={(e) => u("objekat_id", e.target.value)} data-testid="emp-objekat">
                <option value="">— Sjedište (bez objekta) —</option>
                {objekti.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.naziv_objekta}{o.adresa_objekta ? ` · ${o.adresa_objekta}` : ""}
                  </option>
                ))}
              </select>
              <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>
                Ako firma ima više poslovnica/hotela/restorana, odaberi za koji radi ovaj zaposleni.
              </div>
            </div>
          )}
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
