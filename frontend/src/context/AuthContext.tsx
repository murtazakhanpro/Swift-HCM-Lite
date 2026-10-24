import React, { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { api, type User, type SetupStatus } from "../services/api";

interface AuthContextType {
  user: User | null;
  token: string | null;
  setupStatus: SetupStatus | null;
  isLoading: boolean;
  login: (credentials: { email: string; password: string }) => Promise<void>;
  setupFirstRun: (payload: any) => Promise<void>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem("swift_hcm_token"));
  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const checkStatusAndUser = async () => {
    setIsLoading(true);
    try {
      // 1. Check if system first-run setup is completed
      const statusData = await api.getSetupStatus();
      setSetupStatus(statusData);

      // 2. If token exists, load current user
      const storedToken = localStorage.getItem("swift_hcm_token");
      if (storedToken) {
        try {
          const profile = await api.getMyProfile();
          setUser(profile);
          setToken(storedToken);
        } catch (e) {
          // Token invalid/expired
          api.clearToken();
          setUser(null);
          setToken(null);
        }
      }
    } catch (err) {
      console.error("Initialization error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkStatusAndUser();
  }, []);

  const login = async (credentials: { email: string; password: string }) => {
    const res = await api.login(credentials);
    setUser(res.user);
    setToken(res.access_token);
  };

  const setupFirstRun = async (payload: any) => {
    const res = await api.setupFirstRun(payload);
    setUser(res.user);
    setToken(res.access_token);
    setSetupStatus({
      is_setup_completed: true,
      company_name: res.user.company_name,
      admin_exists: true,
    });
  };

  const logout = () => {
    api.clearToken();
    setUser(null);
    setToken(null);
  };

  const refreshProfile = async () => {
    try {
      const profile = await api.getMyProfile();
      setUser(profile);
    } catch (e) {
      console.error("Failed to refresh profile", e);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        setupStatus,
        isLoading,
        login,
        setupFirstRun,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
