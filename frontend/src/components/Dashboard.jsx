import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Buildings,
  Users,
  FileText,
  Receipt,
  Plus,
  TrendUp,
  WarningCircle,
  Clock,
} from "@phosphor-icons/react";
import api from "@/lib/api";

const monthNames = [
  "Januar", "Februar", "Mart", "April", "Maj", "Jun",
  "Jul", "Avgust", "Septembar", "Oktobar", "Novembar", "Decembar",
];

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [docs, setDocs] = useState([]);
  const [expiring, setExpiring] = useState([]);

  useEffect(() => {
    Promise.all([
      api.get("/stats").then((r) => setStats(r.data)),
      api.get("/companies").then((r) => setCompanies(r.data.slice(0, 5))),
      api.get("/documents").then((r) => setDocs(r.data.slice(0, 5))),
      api.get("/reminders/expiring-contracts?days=30").then((r) => setExpiring(r.data)),
    ]).catch(() => {});
  }, []);

  const now = new Date();

  return (
    <div data-testid="dashboard-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dobar dan, Getuard 👋</h1>
          <p className="page-subtitle">
            Evo brzog pregleda vaše agencije za {monthNames[now.getMonth()]} {now.getFullYear()}.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="btn btn-secondary"
            onClick={() => navigate("/dokumenti")}
            data-testid="dashboard-new-doc-btn"
          >
            <FileText size={15} /> Novi dokument
          </button>
          <button
            className="btn btn-primary"
            onClick={() => navigate("/firme")}
            data-testid="dashboard-new-company-btn"
          >
            <Plus size={15} /> Nova firma
          </button>
        </div>
      </div>

      {/* Stats grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 16,
          marginBottom: 32,
        }}
      >
        <StatCard
          icon={<Buildings size={18} />}
          label="Firmi u bazi"
          value={stats?.total_companies ?? "—"}
          sub={`${stats?.active_companies ?? 0} aktivnih`}
          testid="stat-companies"
        />
        <StatCard
          icon={<Users size={18} />}
          label="Zaposlenih"
          value={stats?.total_employees ?? "—"}
          sub="Sve firme"
          testid="stat-employees"
        />
        <StatCard
          icon={<Receipt size={18} />}
          label="PDV obveznika"
          value={stats?.pdv_count ?? "—"}
          sub={`${stats?.ioppd_count ?? 0} IOPPD`}
          testid="stat-pdv"
        />
        <StatCard
          icon={<FileText size={18} />}
          label="Dokumenata mjesec"
          value={stats?.docs_this_month ?? "—"}
          sub={monthNames[now.getMonth()]}
          testid="stat-docs"
        />
      </div>

      {/* Two column section */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Podsjetnici - ugovori koji ističu */}
        {expiring.length > 0 && (
          <div className="card card-padded" style={{ gridColumn: "1 / -1", borderLeft: "3px solid #d97706" }} data-testid="expiring-contracts-widget">
            <SectionHeader
              title={
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <WarningCircle size={18} color="#d97706" weight="fill" />
                  Ugovori koji ističu u narednih 30 dana
                </span>
              }
              action={
                <span className="badge badge-warning">{expiring.length} {expiring.length === 1 ? "ugovor" : "ugovora"}</span>
              }
            />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 10 }}>
              {expiring.slice(0, 6).map((e) => {
                const isExpired = e.days_left < 0;
                const isUrgent = e.days_left <= 7;
                return (
                  <div
                    key={e.id}
                    onClick={() => navigate(`/firme/${e.company_id}`)}
                    style={{
                      padding: 12,
                      background: isExpired ? "#fef2f2" : (isUrgent ? "#fefce8" : "#f8fafc"),
                      border: `1px solid ${isExpired ? "#fecaca" : (isUrgent ? "#fde68a" : "var(--border)")}`,
                      borderRadius: 8,
                      cursor: "pointer",
                      display: "flex",
                      gap: 12,
                      alignItems: "center",
                    }}
                  >
                    <div style={{
                      width: 38, height: 38, borderRadius: 8,
                      background: isExpired ? "#fecaca" : (isUrgent ? "#fde68a" : "#e2e8f0"),
                      color: isExpired ? "#b91c1c" : (isUrgent ? "#a16207" : "#475569"),
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0,
                    }}>
                      <Clock size={18} weight="bold" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13.5, color: "var(--text-primary)" }}>
                        {e.ime} {e.prezime}
                      </div>
                      <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {e.company_naziv} · {e.pozicija || "—"}
                      </div>
                      <div style={{ fontSize: 11.5, marginTop: 4, fontWeight: 500, color: isExpired ? "#b91c1c" : (isUrgent ? "#a16207" : "var(--text-secondary)") }}>
                        {isExpired
                          ? `⚠ Istekao prije ${Math.abs(e.days_left)} ${Math.abs(e.days_left) === 1 ? "dan" : "dana"}`
                          : e.days_left === 0
                          ? "⚠ Ističe DANAS"
                          : `Ističe za ${e.days_left} ${e.days_left === 1 ? "dan" : "dana"}`} · {e.end_date_formatted}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {expiring.length > 6 && (
              <div style={{ marginTop: 12, textAlign: "center" }}>
                <button className="btn btn-ghost btn-sm" onClick={() => navigate("/fizicka-lica")}>
                  Vidi sve ({expiring.length}) →
                </button>
              </div>
            )}
          </div>
        )}

        <div className="card card-padded">
          <SectionHeader
            title="Posljednje firme"
            action={
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => navigate("/firme")}
                data-testid="view-all-companies"
              >
                Vidi sve →
              </button>
            }
          />
          {companies.length === 0 ? (
            <div style={{ padding: "40px 0", textAlign: "center", color: "var(--text-tertiary)", fontSize: 13 }}>
              Još nema unijetih firmi.{" "}
              <button
                className="btn-ghost"
                style={{ color: "var(--accent)", border: "none", background: "none", padding: 0, fontSize: 13 }}
                onClick={() => navigate("/firme")}
              >
                Dodaj prvu →
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {companies.map((c) => (
                <div
                  key={c.id}
                  onClick={() => navigate(`/firme/${c.id}`)}
                  className="clickable"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 8px",
                    borderRadius: 6,
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-surface-hover)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 6,
                      background: "var(--bg-surface-hover)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 12,
                      fontWeight: 700,
                      color: "var(--text-primary)",
                    }}
                  >
                    {c.naziv?.[0]?.toUpperCase() || "?"}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, fontSize: 13.5, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {c.naziv}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-tertiary)", fontFamily: "JetBrains Mono, monospace" }}>
                      PIB {c.pib}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    {c.pdv_obveznik && <span className="badge badge-blue">PDV</span>}
                    {c.ioppd_obveznik && <span className="badge badge-neutral">IOPPD</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card card-padded">
          <SectionHeader
            title="Posljednji dokumenti"
            action={
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => navigate("/dokumenti")}
                data-testid="view-all-docs"
              >
                Vidi sve →
              </button>
            }
          />
          {docs.length === 0 ? (
            <div style={{ padding: "40px 0", textAlign: "center", color: "var(--text-tertiary)", fontSize: 13 }}>
              Još nema generisanih dokumenata.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {docs.map((d) => (
                <div
                  key={d.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 8px",
                    borderRadius: 6,
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 6,
                      background: "#eff6ff",
                      color: "#1d4ed8",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <FileText size={15} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, fontSize: 13, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {d.template?.replace(/\.[^.]+$/, "")}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                      {d.company_naziv} · {new Date(d.created_at).toLocaleDateString("sr-Latn-ME")}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card card-padded" style={{ marginTop: 16 }}>
        <SectionHeader
          title="Brzi prečaci"
          action={
            <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
              <TrendUp size={12} style={{ display: "inline", marginRight: 4 }} />
              Najčešće akcije
            </span>
          }
        />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginTop: 16 }}>
          {[
            { label: "Ugovor o radu", icon: FileText, action: () => navigate("/dokumenti") },
            { label: "Dodaj zaposlenog", icon: Users, action: () => navigate("/firme") },
            { label: "PDV/IOPPD lista", icon: Receipt, action: () => navigate("/pdv-ioppd") },
            { label: "Pregled firmi", icon: Buildings, action: () => navigate("/firme") },
          ].map((q, i) => {
            const Icon = q.icon;
            return (
              <button
                key={i}
                onClick={q.action}
                className="btn btn-secondary"
                style={{ justifyContent: "flex-start", padding: "12px 14px" }}
                data-testid={`quick-action-${i}`}
              >
                <Icon size={16} />
                <span>{q.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const StatCard = ({ icon, label, value, sub, testid }) => (
  <div className="stat-card" data-testid={testid}>
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 10,
      }}
    >
      <div className="stat-label">{label}</div>
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 6,
          background: "var(--bg-surface-hover)",
          color: "var(--text-secondary)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {icon}
      </div>
    </div>
    <div className="stat-value">{value}</div>
    <div className="stat-sub">{sub}</div>
  </div>
);

const SectionHeader = ({ title, action }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 16,
    }}
  >
    <h3
      style={{
        fontFamily: "Cabinet Grotesk, sans-serif",
        fontSize: 16,
        fontWeight: 700,
        letterSpacing: "-0.02em",
        margin: 0,
      }}
    >
      {title}
    </h3>
    {action}
  </div>
);
