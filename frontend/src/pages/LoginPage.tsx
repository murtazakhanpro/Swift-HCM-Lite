import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowRight, AlertCircle, Sparkles } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export const LoginPage: React.FC = () => {
  const { login, setupStatus } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await login({ email, password });
      navigate("/dashboard");
    } catch (err: any) {
      setError(err.message || "Invalid credentials. Please verify and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "var(--bg-canvas)",
      padding: "2rem 1rem",
      backgroundImage: "radial-gradient(circle at 50% 20%, rgba(179, 255, 33, 0.08) 0%, transparent 60%)"
    }}>
      <div style={{
        maxWidth: "460px",
        width: "100%",
        backgroundColor: "var(--bg-surface-0)",
        borderRadius: "20px",
        border: "1px solid var(--border-subtle)",
        padding: "2.5rem 2rem",
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7)"
      }}>
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <img
            src="/assets/Logo/SWIFT-HCM_LITE_logo.jpg"
            alt="Swift-HCM Lite"
            style={{ width: "64px", height: "64px", borderRadius: "16px", border: "1px solid var(--border-accent)", marginBottom: "1rem" }}
          />
          <h1 style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--text-primary)" }}>
            Welcome to <span style={{ color: "var(--swift-neon)" }}>Swift-HCM</span>
          </h1>
          <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
            Sign in with your role-scoped credentials
          </p>
        </div>

        {error && (
          <div style={{
            background: "rgba(251, 36, 54, 0.15)",
            border: "1px solid rgba(251, 36, 54, 0.3)",
            padding: "0.75rem 1rem",
            borderRadius: "8px",
            color: "#FB2436",
            fontSize: "0.85rem",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            marginBottom: "1.5rem"
          }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.4rem" }}>
              Work Email Address
            </label>
            <div style={{ position: "relative" }}>
              <input
                type="email"
                required
                className="swift-input"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
              <label style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                Password
              </label>
            </div>
            <input
              type="password"
              required
              className="swift-input"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="btn-primary"
            style={{ width: "100%", marginTop: "0.5rem", padding: "0.8rem" }}
          >
            <span>{isLoading ? "Authenticating..." : "Sign In to Workspace"}</span>
            <ArrowRight size={16} />
          </button>
        </form>

        {setupStatus && !setupStatus.is_setup_completed && (
          <div style={{ marginTop: "1.75rem", paddingTop: "1.25rem", borderTop: "1px solid var(--border-subtle)", textAlign: "center" }}>
            <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
              First time deploying?
            </p>
            <Link
              to="/setup"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.35rem",
                marginTop: "0.5rem",
                color: "var(--swift-neon)",
                fontSize: "0.85rem",
                fontWeight: 600,
                textDecoration: "none"
              }}
            >
              <Sparkles size={14} /> Run First-Run Setup Wizard
            </Link>
          </div>
        )}

        <div style={{ marginTop: "2rem", textAlign: "center", fontSize: "0.75rem", color: "var(--text-muted)" }}>
          Swift-HCM Lite • Saylani Hackathon 2026 • Lyntica
        </div>
      </div>
    </div>
  );
};
