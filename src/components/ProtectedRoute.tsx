import { ReactNode, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useCompanyContext } from "@/context/CompanyContext";
import { Loader2 } from "lucide-react";

export type UserRole = "admin" | "management" | "supervisor" | "worker" | "viewer";

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: UserRole[];
  requireAuth?: boolean;
  /** Set true for routes that don't need a company (e.g. /onboarding) */
  skipCompanyCheck?: boolean;
}

export const ProtectedRoute = ({
  children,
  allowedRoles = ["admin", "management", "supervisor", "viewer", "worker"],
  requireAuth = true,
  skipCompanyCheck = false,
}: ProtectedRouteProps) => {
  const [authLoading, setAuthLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const location = useLocation();
  const { activeCompany, userRole, loading: companyLoading, memberships } = useCompanyContext();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAuthenticated(!!session);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        setIsAuthenticated(!!session);
        setAuthLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loading = authLoading || companyLoading;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  // Not authenticated → login
  if (requireAuth && !isAuthenticated) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  // Authenticated but no company yet → onboarding
  if (requireAuth && isAuthenticated && !skipCompanyCheck && memberships.length === 0) {
    return <Navigate to="/onboarding" replace />;
  }

  // Company is suspended → show suspended screen
  if (requireAuth && isAuthenticated && !skipCompanyCheck && activeCompany && activeCompany.is_active === false) {
    return <Navigate to="/access-suspended" replace />;
  }

  // Role check against company membership role
  if (requireAuth && isAuthenticated && !skipCompanyCheck && allowedRoles.length > 0) {
    if (!userRole || !allowedRoles.includes(userRole as UserRole)) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <>{children}</>;
};
