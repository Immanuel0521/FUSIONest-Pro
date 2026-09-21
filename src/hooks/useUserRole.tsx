/**
 * useUserRole – reads the current user's role from the active company membership.
 * Falls back to the legacy user_roles table if company membership is unavailable.
 */
import { useCompanyContext, CompanyRole } from "@/context/CompanyContext";

export type UserRole = CompanyRole | "viewer" | null;

export const useUserRole = () => {
  const { userRole, loading, activeCompany, memberships } = useCompanyContext();

  const role: UserRole = userRole ?? null;
  const isAuthenticated = memberships.length > 0 || !!activeCompany;

  return {
    role,
    loading,
    isAuthenticated,
    isAdmin:      role === "admin",
    isManagement: role === "management" || role === "admin",
    isSupervisor: role === "supervisor" || role === "management" || role === "admin",
    isViewer:     !!role,
  };
};
