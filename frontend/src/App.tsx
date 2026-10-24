import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { SetupPage } from "./pages/SetupPage";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { OrgSetupPage } from "./pages/OrgSetupPage";
import { EmployeesPage } from "./pages/EmployeesPage";
import { Employee360Page } from "./pages/Employee360Page";
import { AttendancePage } from "./pages/AttendancePage";
import { AppLayout } from "./components/layout/AppLayout";

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, token, setupStatus, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "var(--bg-canvas)", color: "var(--swift-neon)" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "0.5rem" }}>SWIFT-HCM LITE</div>
          <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>Verifying system access & data scope...</div>
        </div>
      </div>
    );
  }

  // If first-run setup not completed, redirect to /setup
  if (setupStatus && !setupStatus.is_setup_completed) {
    return <Navigate to="/setup" replace />;
  }

  // If not logged in, redirect to /login
  if (!user || !token) {
    return <Navigate to="/login" replace />;
  }

  return <AppLayout>{children}</AppLayout>;
};

const SetupRoute: React.FC = () => {
  const { setupStatus, isLoading } = useAuth();

  if (isLoading) return null;

  // If setup already done, send to login
  if (setupStatus?.is_setup_completed) {
    return <Navigate to="/login" replace />;
  }

  return <SetupPage />;
};

const LoginRoute: React.FC = () => {
  const { user, setupStatus, isLoading } = useAuth();

  if (isLoading) return null;

  if (setupStatus && !setupStatus.is_setup_completed) {
    return <Navigate to="/setup" replace />;
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return <LoginPage />;
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/setup" element={<SetupRoute />} />
          <Route path="/login" element={<LoginRoute />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/org-setup"
            element={
              <ProtectedRoute>
                <OrgSetupPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/employees"
            element={
              <ProtectedRoute>
                <EmployeesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/employees/:id"
            element={
              <ProtectedRoute>
                <Employee360Page />
              </ProtectedRoute>
            }
          />
          <Route
            path="/attendance"
            element={
              <ProtectedRoute>
                <AttendancePage />
              </ProtectedRoute>
            }
          />
          {/* Default fallback */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
