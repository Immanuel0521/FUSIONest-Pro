import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export type UserRole = "admin" | "management" | "supervisor" | "viewer" | null;

export const useUserRole = () => {
  const [role, setRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    checkUserRole(true);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      // Ignore TOKEN_REFRESHED / INITIAL_SESSION which fire on tab focus and would
      // otherwise flip `loading` back to true and unmount the page (looks like a refresh).
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        checkUserRole(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkUserRole = async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setIsAuthenticated(false);
        setRole(null);
        setLoading(false);
        return;
      }

      setIsAuthenticated(true);

      // Check for admin role first
      const { data: adminRole } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();

      if (adminRole) {
        setRole("admin");
        setLoading(false);
        return;
      }

      // Check for management role
      const { data: managementRole } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "management" as any)
        .maybeSingle();

      if (managementRole) {
        setRole("management");
        setLoading(false);
        return;
      }

      // Check for supervisor role
      const { data: supervisorRole } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "supervisor")
        .maybeSingle();

      if (supervisorRole) {
        setRole("supervisor");
        setLoading(false);
        return;
      }

      // Check for viewer role
      const { data: viewerRole } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "viewer")
        .maybeSingle();

      if (viewerRole) {
        setRole("viewer");
      } else {
        // Default to supervisor if authenticated but no role assigned
        setRole("supervisor");
      }
    } catch (error) {
      console.error("Error checking user role:", error);
      setRole(null);
    } finally {
      setLoading(false);
    }
  };

  const isAdmin = role === "admin";
  const isManagement = role === "management";
  const isSupervisor = role === "supervisor" || role === "admin";
  const isViewer = role === "viewer" || role === "supervisor" || role === "admin";

  return { role, loading, isAuthenticated, isAdmin, isManagement, isSupervisor, isViewer };
};
