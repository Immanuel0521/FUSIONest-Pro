import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
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

  const loadCompanies = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setMemberships([]);
        setActiveCompanyId(null);
        setLoading(false);
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
        setActiveCompanyId(ids[0]);
      } else {
        setActiveCompanyId(null);
      }
    } catch (err) {
      console.error("[CompanyContext] unexpected error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCompanies();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "USER_UPDATED") loadCompanies();
      if (event === "SIGNED_OUT") {
        setMemberships([]);
        setActiveCompanyId(null);
        setLoading(false);
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
