import { useEffect, useState } from "react";
import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
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
  Lock,
  CurrencyEur,
  List,
  X,
  Warning,
} from "@phosphor-icons/react";
import api, { clearToken } from "@/lib/api";

const NAV = [
  { to: "/", label: "Pregled", icon: House, end: true },
  { to: "/firme", label: "Firme", icon: Buildings },
  { to: "/fizicka-lica", label: "Fizička lica", icon: Users },
  { to: "/dokumenti", label: "Dokumenti", icon: FileText },
  { to: "/pdv-ioppd", label: "PDV / IOPPD", icon: ListChecks },
  { to: "/finansije", label: "Finansije", icon: CurrencyEur },
];

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [agency, setAgency] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    api
      .get("/agency")
      .then((r) => setAgency(r.data))
      .catch(() => {});
  }, []);

  // Close drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Global toast listener for API errors and custom events
  useEffect(() => {
    const handler = (e) => {
      const id = Math.random().toString(36).slice(2, 9);
      const detail = e.detail || {};
      setToasts((prev) => [...prev, { id, msg: detail.msg || "Greška", type: detail.type || "error" }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4500);
    };
    window.addEventListener("api-error", handler);
    window.addEventListener("toast", handler);
    return () => {
      window.removeEventListener("api-error", handler);
      window.removeEventListener("toast", handler);
    };
  }, []);

  const logout = () => {
    clearToken();
    navigate("/login");
  };

  return (
    <div className="app-shell">
      {mobileOpen && <div className="sidebar-backdrop" onClick={() => setMobileOpen(false)} />}
      <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`} data-testid="sidebar">
        <button
          className="sidebar-close-mobile"
          onClick={() => setMobileOpen(false)}
          aria-label="Zatvori meni"
          data-testid="sidebar-close"
        >
          <X size={20} />
        </button>
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
            const isFirme = item.to === "/firme";
            const showSub = isFirme && (location.pathname.startsWith("/firme") || location.pathname.startsWith("/osnivanje") || location.pathname.startsWith("/evidencija-rada") || location.pathname.startsWith("/specijalno-punomocje") || location.pathname.startsWith("/vault"));
            return (
              <div key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}
                  data-testid={`nav-${item.to.replace("/", "") || "dashboard"}`}
                >
                  <Icon size={17} weight="regular" />
                  <span>{item.label}</span>
                </NavLink>
                {showSub && (
                  <>
                    <NavLink
                      to="/osnivanje"
                      className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}
                      data-testid="nav-osnivanje-doo"
                      style={{ marginLeft: 24, fontSize: 13, paddingTop: 6, paddingBottom: 6 }}
                    >
                      <Plus size={14} />
                      <span>Osnivanje DOO</span>
                    </NavLink>
                    <NavLink
                      to="/specijalno-punomocje"
                      className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}
                      data-testid="nav-specijalno-punomocje"
                      style={{ marginLeft: 24, fontSize: 13, paddingTop: 6, paddingBottom: 6 }}
                    >
                      <FileText size={14} />
                      <span>Specijalno punomoćje</span>
                    </NavLink>
                    <NavLink
                      to="/vault"
                      className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}
                      data-testid="nav-vault"
                      style={{ marginLeft: 24, fontSize: 13, paddingTop: 6, paddingBottom: 6 }}
                    >
                      <Lock size={14} />
                      <span>Passwordi za token / lične karte</span>
                    </NavLink>
                    <NavLink
                      to="/evidencija-rada"
                      className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}
                      data-testid="nav-evidencija-rada"
                      style={{ marginLeft: 24, fontSize: 13, paddingTop: 6, paddingBottom: 6 }}
                    >
                      <ListChecks size={14} />
                      <span>Evidencija rada</span>
                    </NavLink>
                  </>
                )}
              </div>
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
          <button
            className="hamburger-btn"
            onClick={() => setMobileOpen(true)}
            aria-label="Otvori meni"
            data-testid="hamburger-btn"
          >
            <List size={20} />
          </button>
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
              className="topbar-kbd"
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
            className="topbar-meta"
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
      
      {/* Global toast stack */}
      <div style={{ position: "fixed", bottom: 20, right: 20, zIndex: 9999, display: "flex", flexDirection: "column", gap: 8, maxWidth: 360 }} data-testid="toast-stack">
        {toasts.map((t) => (
          <div
            key={t.id}
            style={{
              background: t.type === "success" ? "#10b981" : "#ef4444",
              color: "white",
              padding: "11px 14px",
              borderRadius: 8,
              boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontSize: 13.5,
              fontWeight: 500,
              animation: "slide-up 220ms ease",
            }}
            data-testid={`toast-${t.type}`}
          >
            <Warning size={18} weight="fill" />
            <span style={{ flex: 1 }}>{t.msg}</span>
            <button
              onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
              style={{ background: "transparent", border: "none", color: "white", cursor: "pointer", padding: 2, opacity: 0.7 }}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
