import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Shield, MapPin, Sparkles, CheckCircle2, AlertCircle } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export const SetupPage: React.FC = () => {
  const { setupFirstRun } = useAuth();
  const navigate = useNavigate();

  const [companyName, setCompanyName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [officeStart, setOfficeStart] = useState("09:00");
  const [graceMinutes, setGraceMinutes] = useState(15);
  const [officeLat, setOfficeLat] = useState(24.8607);
  const [officeLng, setOfficeLng] = useState(67.0011);
  const [officeRadius, setOfficeRadius] = useState(150);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGetCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setOfficeLat(parseFloat(pos.coords.latitude.toFixed(6)));
          setOfficeLng(parseFloat(pos.coords.longitude.toFixed(6)));
        },
        (err) => {
          console.warn("Could not get GPS location", err);
        }
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (adminPassword.length < 6) {
      setError("Admin password must be at least 6 characters.");
      return;
    }

    if (adminPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsLoading(true);
    try {
      await setupFirstRun({
        company_name: companyName,
        admin_email: adminEmail,
        admin_password: adminPassword,
        office_start: officeStart,
        grace_minutes: graceMinutes,
        office_lat: officeLat,
        office_lng: officeLng,
        office_radius_meters: officeRadius,
      });
      navigate("/dashboard");
    } catch (err: any) {
      setError(err.message || "First-run setup failed");
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
      backgroundImage: "radial-gradient(ellipse at 50% 0%, rgba(179, 255, 33, 0.08) 0%, transparent 70%)"
    }}>
      <div style={{
        maxWidth: "920px",
        width: "100%",
        display: "grid",
        gridTemplateColumns: "1fr 1.3fr",
        gap: "2rem",
        backgroundColor: "var(--bg-surface-0)",
        borderRadius: "20px",
        border: "1px solid var(--border-subtle)",
        overflow: "hidden",
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7)"
      }}>
        {/* Left Side: Brand & Feature Highlights */}
        <div style={{
          padding: "2.5rem 2rem",
          backgroundColor: "var(--bg-surface-1)",
          borderRight: "1px solid var(--border-subtle)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between"
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.85rem", marginBottom: "1.5rem" }}>
              <img
                src="/assets/Logo/App_logo_icon.jpg"
                alt="Swift-HCM Lite"
                style={{ width: "48px", height: "48px", borderRadius: "12px", border: "1px solid var(--border-accent)" }}
              />
              <div>
                <h1 style={{ fontSize: "1.35rem", fontWeight: 800, color: "var(--swift-neon)" }}>
                  SWIFT-HCM LITE
                </h1>
                <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                  Enterprise Human Capital Management
                </p>
              </div>
            </div>

            <h2 style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: "0.75rem" }}>
              First-Run System Initialization
            </h2>
            <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: "1.5rem" }}>
              Saylani Hackathon 2026 Edition. Swift-HCM Lite starts with a verified clean database. Complete this one-time setup to establish your organization, policies, and master Admin account.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
                <div style={{ padding: "0.4rem", borderRadius: "8px", background: "rgba(179, 255, 33, 0.12)", color: "var(--swift-neon)" }}>
                  <Shield size={16} />
                </div>
                <div>
                  <h4 style={{ fontSize: "0.85rem", fontWeight: 600 }}>Zero Dummy Data</h4>
                  <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>All figures and insights come strictly from live user activity.</p>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
                <div style={{ padding: "0.4rem", borderRadius: "8px", background: "rgba(1, 90, 255, 0.12)", color: "var(--swift-blue)" }}>
                  <Sparkles size={16} />
                </div>
                <div>
                  <h4 style={{ fontSize: "0.85rem", fontWeight: 600 }}>AI Assistant & Analytics</h4>
                  <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Scoped tool-calling powered by Gemini 3.5 Flash.</p>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
                <div style={{ padding: "0.4rem", borderRadius: "8px", background: "rgba(202, 164, 125, 0.12)", color: "#CAA47D" }}>
                  <MapPin size={16} />
                </div>
                <div>
                  <h4 style={{ fontSize: "0.85rem", fontWeight: 600 }}>Camera Attendance & Geofencing</h4>
                  <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Haversine office geofence & on-device face verification.</p>
                </div>
              </div>
            </div>
          </div>

          <div style={{ marginTop: "2rem", paddingTop: "1rem", borderTop: "1px solid var(--border-subtle)", fontSize: "0.75rem", color: "var(--text-muted)" }}>
            Engineered by <span style={{ color: "var(--swift-neon)", fontWeight: 600 }}>Lyntica</span> • Murtaza Ali Khan & Fiza Baneen Khan
          </div>
        </div>

        {/* Right Side: Setup Form */}
        <div style={{ padding: "2.5rem 2.25rem", overflowY: "auto", maxHeight: "88vh" }}>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Building2 size={20} color="var(--swift-neon)" /> Company Profile
            </h3>

            {error && (
              <div style={{
                background: "rgba(251, 36, 54, 0.15)",
                border: "1px solid rgba(251, 36, 54, 0.3)",
                padding: "0.75rem",
                borderRadius: "8px",
                color: "#FB2436",
                fontSize: "0.85rem",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem"
              }}>
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.35rem" }}>
                Company Name *
              </label>
              <input
                type="text"
                required
                className="swift-input"
                placeholder="e.g. Lyntica Technologies or Zaitoon IT Park"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.35rem" }}>
                  Office Start Time
                </label>
                <input
                  type="time"
                  required
                  className="swift-input"
                  value={officeStart}
                  onChange={(e) => setOfficeStart(e.target.value)}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.35rem" }}>
                  Grace Period (Minutes)
                </label>
                <input
                  type="number"
                  min="0"
                  max="60"
                  required
                  className="swift-input"
                  value={graceMinutes}
                  onChange={(e) => setGraceMinutes(parseInt(e.target.value) || 0)}
                />
              </div>
            </div>

            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.5rem" }}>
              <MapPin size={20} color="var(--swift-blue)" /> Attendance Geofence
            </h3>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.35rem" }}>
                  Office Latitude
                </label>
                <input
                  type="number"
                  step="0.000001"
                  required
                  className="swift-input"
                  value={officeLat}
                  onChange={(e) => setOfficeLat(parseFloat(e.target.value))}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.35rem" }}>
                  Office Longitude
                </label>
                <input
                  type="number"
                  step="0.000001"
                  required
                  className="swift-input"
                  value={officeLng}
                  onChange={(e) => setOfficeLng(parseFloat(e.target.value))}
                />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ flex: 1, marginRight: "1rem" }}>
                <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.35rem" }}>
                  Geofence Radius (Meters)
                </label>
                <input
                  type="number"
                  min="10"
                  max="1000"
                  required
                  className="swift-input"
                  value={officeRadius}
                  onChange={(e) => setOfficeRadius(parseInt(e.target.value) || 150)}
                />
              </div>
              <button
                type="button"
                onClick={handleGetCurrentLocation}
                className="btn-secondary"
                style={{ alignSelf: "flex-end", padding: "0.65rem 0.85rem", fontSize: "0.75rem" }}
              >
                Use Current GPS
              </button>
            </div>

            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.5rem" }}>
              <Shield size={20} color="var(--swift-neon)" /> Master Admin Account
            </h3>

            <div>
              <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.35rem" }}>
                Admin Email Address *
              </label>
              <input
                type="email"
                required
                className="swift-input"
                placeholder="admin@yourcompany.com"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.35rem" }}>
                  Admin Password *
                </label>
                <input
                  type="password"
                  required
                  className="swift-input"
                  placeholder="Min 6 characters"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.35rem" }}>
                  Confirm Password *
                </label>
                <input
                  type="password"
                  required
                  className="swift-input"
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary"
              style={{ width: "100%", marginTop: "1rem", padding: "0.85rem" }}
            >
              <CheckCircle2 size={18} />
              {isLoading ? "Initializing Organization..." : "Complete Setup & Launch Swift-HCM"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
