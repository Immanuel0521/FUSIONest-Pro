import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";

// ── Types ─────────────────────────────────────────────────────────────────────
export type CompanyRole = "admin" | "management" | "supervisor" | "worker";

export interface Company {
  id: string;
  name: string;
  company_code: string;
  join_code: string;
  logo_url: string | null;
  industry: string | null;
  address: string | null;
  created_by: string | null;
  created_at: string;
  is_active: boolean;
  suspended_reason: string | null;
}

export interface CompanyMembership {
  id: string;
  company_id: string;
  user_id: string;
  role: CompanyRole;
  is_active: boolean;
  joined_at: string;
  company: Company;
}

interface CompanyContextValue {
  /** The company the user is currently working in */
  activeCompany: Company | null;
  /** The user's role inside the active company */
  userRole: CompanyRole | null;
  /** All companies the user belongs to */
  memberships: CompanyMembership[];
  loading: boolean;
  /** Switch the active company and persist choice to user_profiles */
  switchCompany: (companyId: string) => Promise<void>;
  /** Re-fetch memberships from the server */
  refreshCompanies: () => Promise<void>;
}

// ── Context ────────────────────────────────────────────────────────────────────
const CompanyContext = createContext<CompanyContextValue>({
  activeCompany: null,
  userRole: null,
  memberships: [],
  loading: true,
  switchCompany: async () => {},
  refreshCompanies: async () => {},
});

export const useCompanyContext = () => useContext(CompanyContext);

// ── Provider ───────────────────────────────────────────────────────────────────
export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const [memberships, setMemberships] = useState<CompanyMembership[]>([]);
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const hasLoadedRef = useRef(false);

  const loadCompanies = useCallback(async (silent = false) => {
    // Only show full-screen loading on the initial cold load
    if (!silent && !hasLoadedRef.current) {
      setLoading(true);
    }
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) {
        setMemberships([]);
        setActiveCompanyId(null);
        setLoading(false);
        hasLoadedRef.current = true;
        return;
      }

      // Load memberships + nested company data
      const { data: memberData, error } = await (supabase
        .from("company_members")
        .select("*, company:companies(*)")
        .eq("user_id", user.id)
        .eq("is_active", true) as any);

      if (error) {
        console.error("[CompanyContext] load memberships:", error.message);
        setLoading(false);
        hasLoadedRef.current = true;
        return;
      }

      const members = (memberData as CompanyMembership[]) ?? [];
      setMemberships(members);

      // Determine active company from saved preference
      const { data: profile } = await (supabase
        .from("user_profiles")
        .select("active_company_id")
        .eq("id", user.id)
        .maybeSingle() as any);

      const preferred = profile?.active_company_id as string | null;
      const ids = members.map((m) => m.company_id);

      if (preferred && ids.includes(preferred)) {
        setActiveCompanyId(preferred);
      } else if (ids.length > 0) {
        setActiveCompanyId((current) => (current && ids.includes(current) ? current : ids[0]));
      } else {
        setActiveCompanyId(null);
      }
    } catch (err) {
      console.error("[CompanyContext] unexpected error:", err);
    } finally {
      setLoading(false);
      hasLoadedRef.current = true;
    }
  }, []);

  useEffect(() => {
    loadCompanies();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      // Ignore TOKEN_REFRESHED: only reload on explicit sign in or user update, silently
      if (event === "SIGNED_IN" || event === "USER_UPDATED") {
        loadCompanies(true);
      }
      if (event === "SIGNED_OUT") {
        setMemberships([]);
        setActiveCompanyId(null);
        setLoading(false);
        hasLoadedRef.current = false;
      }
    });

    return () => subscription.unsubscribe();
  }, [loadCompanies]);

  const switchCompany = useCallback(async (companyId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setActiveCompanyId(companyId);

    await (supabase.from("user_profiles") as any).upsert(
      { id: user.id, active_company_id: companyId, updated_at: new Date().toISOString() },
      { onConflict: "id" }
    );
  }, []);

  const activeMembership = memberships.find((m) => m.company_id === activeCompanyId);

  return (
    <CompanyContext.Provider
      value={{
        activeCompany: activeMembership?.company ?? null,
        userRole: activeMembership?.role ?? null,
        memberships,
        loading,
        switchCompany,
        refreshCompanies: loadCompanies,
      }}
    >
      {children}
    </CompanyContext.Provider>
  );
}
