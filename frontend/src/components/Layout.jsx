import { useEffect, useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import {
  House,
  Buildings,
  FileText,
  ListChecks,
  Gear,
  SignOut,
  MagnifyingGlass,
  Bell,
  Users,
  Plus,
} from "@phosphor-icons/react";
import api, { clearToken } from "@/lib/api";

const NAV = [
  { to: "/", label: "Pregled", icon: House, end: true },
  { to: "/firme", label: "Firme", icon: Buildings },
  { to: "/osnivanje", label: "Osnivanje DOO", icon: Plus },
  { to: "/fizicka-lica", label: "Fizička lica", icon: Users },
  { to: "/dokumenti", label: "Dokumenti", icon: FileText },
  { to: "/pdv-ioppd", label: "PDV / IOPPD", icon: ListChecks },
];

export default function Layout() {
  const navigate = useNavigate();
  const [agency, setAgency] = useState(null);

  useEffect(() => {
    api
      .get("/agency")
      .then((r) => setAgency(r.data))
      .catch(() => {});
  }, []);

  const logout = () => {
    clearToken();
    navigate("/login");
  };

  return (
    <div className="app-shell">
      <aside className="sidebar" data-testid="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-brand-mark">AA</div>
          <div className="sidebar-brand-text">
            <span className="sidebar-brand-name">
              Advanced Accounting
            </span>
            <span className="sidebar-brand-sub">Agencija</span>
          </div>
        </div>

        <div className="sidebar-section">Glavni meni</div>
        <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {NAV.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}
                data-testid={`nav-${item.to.replace("/", "") || "dashboard"}`}
              >
                <Icon size={17} weight="regular" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="sidebar-section">Podešavanja</div>
        <NavLink
          to="/agencija"
          className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}
          data-testid="nav-agencija"
        >
          <Gear size={17} />
          <span>Moja agencija</span>
        </NavLink>

        <div className="sidebar-footer">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 10px",
              borderRadius: 6,
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 6,
                background: "#0f172a",
                color: "white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              GC
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)" }}>
                Getuard Cekoviq
              </div>
              <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Vlasnik</div>
            </div>
            <button
              className="btn-ghost"
              onClick={logout}
              title="Odjava"
              style={{
                border: "none",
                background: "transparent",
                color: "var(--text-tertiary)",
                padding: 6,
                borderRadius: 6,
                cursor: "pointer",
                display: "flex",
              }}
              data-testid="logout-button"
            >
              <SignOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <div className="topbar-search">
            <MagnifyingGlass size={15} color="var(--text-tertiary)" />
            <input
              placeholder="Brzo pretraži firmu, zaposlenog ili dokument..."
              data-testid="global-search"
            />
            <span
              style={{
                fontSize: 11,
                color: "var(--text-tertiary)",
                background: "white",
                border: "1px solid var(--border)",
                padding: "1px 6px",
                borderRadius: 4,
                fontFamily: "JetBrains Mono, monospace",
              }}
            >
              ⌘K
            </span>
          </div>
          <div style={{ flex: 1 }} />
          <button
            className="btn btn-ghost"
            style={{ padding: 7, borderRadius: 6 }}
            data-testid="topbar-notifications"
          >
            <Bell size={17} />
          </button>
          <div
            style={{
              fontSize: 12.5,
              color: "var(--text-tertiary)",
              borderLeft: "1px solid var(--border)",
              paddingLeft: 16,
            }}
          >
            <span style={{ fontWeight: 500, color: "var(--text-secondary)" }}>Ulcinj</span> ·{" "}
            {new Date().toLocaleDateString("sr-Latn-ME", {
              day: "2-digit",
              month: "long",
              year: "numeric",
            })}
          </div>
        </header>

        <main className="content animate-fade-in">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
