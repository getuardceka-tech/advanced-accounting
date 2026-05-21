import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, User, Eye, EyeSlash, Buildings, ShieldCheck, Sparkle } from "@phosphor-icons/react";
import api, { setToken } from "@/lib/api";

export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("getuard");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const resp = await api.post("/auth/login", { username, password });
      setToken(resp.data.access_token);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err.response?.data?.detail || "Greška pri prijavi");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-shell" data-testid="login-page">
      <div className="login-side">
        <div className="flex items-center gap-2.5">
          <div className="sidebar-brand-mark" style={{ background: "white", color: "#0f172a" }}>
            AA
          </div>
          <div className="sidebar-brand-text">
            <span className="sidebar-brand-name" style={{ color: "white" }}>
              Advanced Accounting
            </span>
            <span className="sidebar-brand-sub" style={{ color: "#94a3b8" }}>
              Agencija za računovodstvo · Ulcinj
            </span>
          </div>
        </div>

        <div className="max-w-md">
          <h1
            className="text-white"
            style={{
              fontFamily: "Cabinet Grotesk, sans-serif",
              fontSize: 38,
              fontWeight: 800,
              letterSpacing: "-0.03em",
              lineHeight: 1.05,
            }}
          >
            Profesionalni softver za vašu agenciju.
          </h1>
          <p style={{ color: "#94a3b8", marginTop: 16, fontSize: 15, lineHeight: 1.6 }}>
            Upravljajte klijentima, zaposlenima, dokumentima i predajama PDV-a i IOPPD-a.
            Sve na jednom mjestu — brzo, sigurno i bez gubitka vremena.
          </p>

          <div className="mt-10 space-y-4">
            {[
              { icon: <Buildings size={18} />, text: "50+ firmi klijenata u bazi" },
              { icon: <Sparkle size={18} />, text: "Automatsko generisanje dokumenata" },
              { icon: <ShieldCheck size={18} />, text: "Sigurni podaci uz IRMS integraciju" },
            ].map((f, i) => (
              <div key={i} className="flex items-center gap-3" style={{ color: "#cbd5e1" }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 6,
                    background: "rgba(255,255,255,0.08)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {f.icon}
                </div>
                <span style={{ fontSize: 14 }}>{f.text}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ color: "#64748b", fontSize: 12 }}>
          © 2026 Advanced Accounting · Ulcinj, Crna Gora
        </div>
      </div>

      <div className="login-form-wrap">
        <form className="login-form animate-fade-in" onSubmit={submit}>
          <h2
            style={{
              fontFamily: "Cabinet Grotesk, sans-serif",
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: "-0.025em",
              marginBottom: 8,
            }}
          >
            Dobrodošli nazad
          </h2>
          <p style={{ color: "var(--text-tertiary)", fontSize: 14, marginBottom: 32 }}>
            Prijavite se da pristupite kontrolnoj tabli vaše agencije.
          </p>

          <div className="field-group" style={{ marginBottom: 16 }}>
            <label className="field-label">Korisničko ime</label>
            <div style={{ position: "relative" }}>
              <User
                size={16}
                style={{
                  position: "absolute",
                  left: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--text-tertiary)",
                }}
              />
              <input
                type="text"
                className="input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                style={{ paddingLeft: 36 }}
                data-testid="login-username-input"
                autoFocus
              />
            </div>
          </div>

          <div className="field-group" style={{ marginBottom: 24 }}>
            <label className="field-label">Lozinka</label>
            <div style={{ position: "relative" }}>
              <Lock
                size={16}
                style={{
                  position: "absolute",
                  left: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--text-tertiary)",
                }}
              />
              <input
                type={showPwd ? "text" : "password"}
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ paddingLeft: 36, paddingRight: 36 }}
                data-testid="login-password-input"
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                style={{
                  position: "absolute",
                  right: 8,
                  top: "50%",
                  transform: "translateY(-50%)",
                  border: "none",
                  background: "transparent",
                  color: "var(--text-tertiary)",
                  padding: 4,
                  display: "flex",
                }}
                data-testid="login-toggle-password"
              >
                {showPwd ? <EyeSlash size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <div
              style={{
                padding: "10px 12px",
                background: "var(--danger-bg)",
                color: "var(--danger-text)",
                borderRadius: 6,
                fontSize: 13,
                marginBottom: 16,
              }}
              data-testid="login-error"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary btn-lg"
            style={{ width: "100%" }}
            disabled={loading || !password}
            data-testid="login-submit-button"
          >
            {loading ? "Prijavljujem..." : "Prijavi se"}
          </button>

          <p style={{ marginTop: 24, fontSize: 12, color: "var(--text-tertiary)", textAlign: "center" }}>
            Master pristup je rezervisan samo za vlasnika agencije.
          </p>
        </form>
      </div>
    </div>
  );
}
