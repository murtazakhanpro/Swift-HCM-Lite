import React, { useState } from "react";
import { KeyRound, AlertCircle, Lock } from "lucide-react";
import { api } from "../../services/api";
import { useAuth } from "../../context/AuthContext";

interface Props {
  isOpen: boolean;
  onSuccess: () => void;
}

export const ChangePasswordModal: React.FC<Props> = ({ isOpen, onSuccess }) => {
  const { user, refreshProfile } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New password and confirm password do not match.");
      return;
    }

    setIsLoading(true);
    try {
      await api.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      await refreshProfile();
      onSuccess();
    } catch (err: any) {
      setError(err.message || "Failed to update password");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      backgroundColor: "rgba(0, 0, 0, 0.85)",
      backdropFilter: "blur(8px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 9999,
      padding: "1rem"
    }}>
      <div className="glass-panel" style={{
        maxWidth: "460px",
        width: "100%",
        padding: "2rem",
        borderRadius: "16px",
        border: "1px solid rgba(179, 255, 33, 0.3)",
        boxShadow: "0 20px 40px rgba(0, 0, 0, 0.8), 0 0 30px rgba(179, 255, 33, 0.15)"
      }}>
        <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
          <div style={{
            width: "56px",
            height: "56px",
            borderRadius: "14px",
            background: "rgba(179, 255, 33, 0.15)",
            border: "1px solid rgba(179, 255, 33, 0.4)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "1rem"
          }}>
            <KeyRound size={28} color="#B3FF21" />
          </div>
          <h2 style={{ fontSize: "1.35rem", fontWeight: 700, color: "var(--text-primary)" }}>
            {user?.must_change_password ? "First Login: Set New Password" : "Change Password"}
          </h2>
          <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginTop: "0.35rem" }}>
            {user?.must_change_password
              ? "For security, you must update your temporary password before accessing the system."
              : "Enter your current password and choose a secure new password."}
          </p>
        </div>

        {error && (
          <div style={{
            background: "rgba(255, 51, 68, 0.15)",
            border: "1px solid rgba(255, 51, 68, 0.3)",
            padding: "0.75rem",
            borderRadius: "8px",
            color: "#FF3344",
            fontSize: "0.85rem",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            marginBottom: "1.25rem"
          }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.35rem" }}>
              Current Password
            </label>
            <div style={{ position: "relative" }}>
              <input
                type="password"
                required
                className="swift-input"
                placeholder="Enter current password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.35rem" }}>
              New Password (min 6 characters)
            </label>
            <input
              type="password"
              required
              className="swift-input"
              placeholder="Enter secure new password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "0.35rem" }}>
              Confirm New Password
            </label>
            <input
              type="password"
              required
              className="swift-input"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={isLoading}
            style={{ width: "100%", marginTop: "0.5rem" }}
          >
            <Lock size={16} />
            {isLoading ? "Updating..." : "Update Password & Continue"}
          </button>
        </form>
      </div>
    </div>
  );
};
