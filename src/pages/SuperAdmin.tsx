import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Shield, Building2, Users, ArrowLeft, RefreshCw,
  CheckCircle2, Trash2, Search, Crown, Ban,
  RotateCcw, Pencil, SlidersHorizontal, Save, Loader2
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface CompanyRow {
  id: string;
  name: string;
  company_code: string;
  industry: string | null;
  address: string | null;
  logo_url: string | null;
  is_active: boolean;
  suspended_reason: string | null;
  created_at: string;
  member_count: number;
  admin_email: string | null;
}

interface UserRow {
  user_id: string;
  full_name: string | null;
  email: string;
  photo_url: string | null;
  is_super_admin: boolean;
  max_companies_allowed?: number;
  created_at: string;
  company_count: number;
}

export default function SuperAdmin() {
  const navigate = useNavigate();
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean | null>(null);
  const [companies, setCompanies]       = useState<CompanyRow[]>([]);
  const [users, setUsers]               = useState<UserRow[]>([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState("");

  // Suspend dialog state
  const [suspendTarget, setSuspendTarget] = useState<CompanyRow | null>(null);
  const [suspendReason, setSuspendReason] = useState("");

  // Edit company dialog state
  const [editCompanyTarget, setEditCompanyTarget] = useState<CompanyRow | null>(null);
  const [editName, setEditName]                   = useState("");
  const [editIndustry, setEditIndustry]           = useState("");
  const [editAddress, setEditAddress]             = useState("");

  // User quota dialog state
  const [quotaUserTarget, setQuotaUserTarget]     = useState<UserRow | null>(null);
  const [quotaValue, setQuotaValue]               = useState<number>(5);

  useEffect(() => {
    checkSuperAdmin();
  }, []);

  const checkSuperAdmin = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/"); return; }

    const { data } = await supabase
      .from("user_profiles")
      .select("is_super_admin")
      .eq("id", user.id)
      .maybeSingle();

    if (!data?.is_super_admin) {
      setIsSuperAdmin(false);
      return;
    }
    setIsSuperAdmin(true);
    loadData();
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [{ data: c, error: cErr }, { data: u, error: uErr }] = await Promise.all([
        (supabase.rpc as any)("get_all_companies_superadmin"),
        (supabase.rpc as any)("get_all_users_superadmin"),
      ]);

      let finalCompanies: CompanyRow[] = c || [];
      let finalUsers: UserRow[] = u || [];

      // Fallback if RPC encounters column ambiguity or fails
      if (cErr || !c || c.length === 0) {
        if (cErr) console.warn("[SuperAdmin] get_all_companies_superadmin RPC error:", cErr);
        const { data: directCompanies } = await (supabase
          .from("companies")
          .select("*, company_members(id, is_active)")
          .order("created_at", { ascending: false }) as any);

        if (directCompanies && directCompanies.length > 0) {
          finalCompanies = directCompanies.map((comp: any) => ({
            id: comp.id,
            name: comp.name,
            company_code: comp.company_code,
            industry: comp.industry,
            address: comp.address,
            logo_url: comp.logo_url,
            is_active: comp.is_active ?? true,
            suspended_reason: comp.suspended_reason,
            created_at: comp.created_at,
            member_count: comp.company_members?.filter((m: any) => m.is_active !== false).length || 0,
            admin_email: null,
          }));
        }
      }

      if (uErr || !u || u.length === 0) {
        if (uErr) console.warn("[SuperAdmin] get_all_users_superadmin RPC error:", uErr);
        const { data: directProfiles } = await (supabase
          .from("user_profiles")
          .select("*, company_members(company_id, is_active)")
          .order("created_at", { ascending: false }) as any);

        if (directProfiles && directProfiles.length > 0) {
          finalUsers = directProfiles.map((p: any) => ({
            user_id: p.id,
            full_name: p.full_name,
            email: p.full_name || "User",
            photo_url: p.photo_url,
            is_super_admin: p.is_super_admin || false,
            max_companies_allowed: p.max_companies_allowed || 5,
            created_at: p.created_at,
            company_count: p.company_members?.filter((m: any) => m.is_active !== false).length || 0,
          }));
        }
      }

      setCompanies(finalCompanies);
      setUsers(finalUsers);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAccess = async (company: CompanyRow, reason?: string) => {
    try {
      const { error } = await (supabase.rpc as any)("toggle_company_access", {
        p_company_id: company.id,
        p_is_active:  !company.is_active,
        p_reason:     reason || null,
      });
      if (error) throw error;
      setCompanies(prev => prev.map(c =>
        c.id === company.id ? { ...c, is_active: !c.is_active, suspended_reason: reason || null } : c
      ));
      toast.success(company.is_active ? `"${company.name}" access suspended` : `"${company.name}" access restored`);
      setSuspendTarget(null);
      setSuspendReason("");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleSaveCompanyEdit = async () => {
    if (!editCompanyTarget) return;
    try {
      const { error } = await (supabase.rpc as any)("admin_update_company_by_superadmin", {
        p_company_id: editCompanyTarget.id,
        p_name: editName.trim(),
        p_industry: editIndustry.trim() || null,
        p_address: editAddress.trim() || null,
        p_is_active: editCompanyTarget.is_active,
        p_reason: editCompanyTarget.suspended_reason,
      });
      if (error) throw error;

      setCompanies(prev => prev.map(c =>
        c.id === editCompanyTarget.id
          ? { ...c, name: editName.trim(), industry: editIndustry.trim() || null, address: editAddress.trim() || null }
          : c
      ));
      toast.success("Company updated successfully!");
      setEditCompanyTarget(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to update company");
    }
  };

  const handleSaveUserQuota = async () => {
    if (!quotaUserTarget) return;
    try {
      const { error } = await (supabase.rpc as any)("set_user_company_quota", {
        p_user_id: quotaUserTarget.user_id,
        p_quota: quotaValue,
      });
      if (error) throw error;

      setUsers(prev => prev.map(u =>
        u.user_id === quotaUserTarget.user_id
          ? { ...u, max_companies_allowed: quotaValue }
          : u
      ));
      toast.success(`Updated limit for ${quotaUserTarget.email} to ${quotaValue} companies`);
      setQuotaUserTarget(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to update quota");
    }
  };

  const handleDeleteCompany = async (company: CompanyRow) => {
    try {
      const { error } = await (supabase.rpc as any)("delete_company_superadmin", { p_company_id: company.id });
      if (error) throw error;
      setCompanies(prev => prev.filter(c => c.id !== company.id));
      toast.success(`"${company.name}" permanently deleted`);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const filteredCompanies = companies.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.company_code.toLowerCase().includes(search.toLowerCase()) ||
    (c.admin_email || "").toLowerCase().includes(search.toLowerCase())
  );

  const filteredUsers = users.filter(u =>
    (u.full_name || "").toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  // Stats
  const stats = {
    total:     companies.length,
    active:    companies.filter(c => c.is_active).length,
    suspended: companies.filter(c => !c.is_active).length,
    users:     users.length,
  };

  // ── Verifying authorization ────────────────────────────────────────────────
  if (isSuperAdmin === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground text-sm">Verifying super admin permissions...</p>
        </div>
      </div>
    );
  }

  // ── Not authorized ─────────────────────────────────────────────────────────
  if (isSuperAdmin === false) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h1 className="text-xl font-bold">Not Authorized</h1>
          <p className="text-muted-foreground text-sm mt-1">Super admin access required.</p>
          <Button className="mt-4" onClick={() => navigate("/dashboard")}>Go to Dashboard</Button>
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <div className="sticky top-0 z-50 border-b border-border/30 glass-heavy px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <Crown className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <h1 className="font-bold text-sm">FUSIONest Pro — Website Super Admin</h1>
              <p className="text-xs text-muted-foreground">Platform-Wide Company & User Access Control</p>
            </div>
          </div>
        </div>
        <Button variant="outline" size="sm" className="rounded-xl gap-2" onClick={loadData} disabled={loading}>
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Total Companies", value: stats.total,     icon: Building2, color: "text-blue-600   bg-blue-50   dark:bg-blue-900/20" },
            { label: "Active",          value: stats.active,    icon: CheckCircle2, color: "text-green-600  bg-green-50  dark:bg-green-900/20" },
            { label: "Suspended",       value: stats.suspended, icon: Ban,       color: "text-red-600    bg-red-50    dark:bg-red-900/20" },
            { label: "Total Users",     value: stats.users,     icon: Users,     color: "text-purple-600 bg-purple-50 dark:bg-purple-900/20" },
          ].map(({ label, value, icon: Icon, color }) => (
            <Card key={label} className="rounded-3xl border-border/30 glass-heavy">
              <CardContent className="pt-5 pb-4">
                <div className={`w-9 h-9 rounded-xl ${color} flex items-center justify-center mb-3`}>
                  <Icon className="w-4.5 h-4.5" />
                </div>
                <p className="text-2xl font-bold">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search companies or users..."
            className="pl-9 rounded-2xl"
          />
        </div>

        <Tabs defaultValue="companies">
          <TabsList className="glass-heavy rounded-2xl p-1 h-auto gap-1">
            <TabsTrigger value="companies" className="rounded-xl gap-2 px-4 py-2">
              <Building2 className="w-4 h-4" /> Companies ({stats.total})
            </TabsTrigger>
            <TabsTrigger value="users" className="rounded-xl gap-2 px-4 py-2">
              <Users className="w-4 h-4" /> Users & Limits ({stats.users})
            </TabsTrigger>
          </TabsList>

          {/* ── Companies Tab ───────────────────────────────────────────── */}
          <TabsContent value="companies" className="mt-4 space-y-3">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-20 rounded-3xl bg-muted/40 animate-pulse" />
              ))
            ) : filteredCompanies.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">No companies found</div>
            ) : (
              filteredCompanies.map(company => (
                <motion.div
                  key={company.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className={`rounded-3xl border glass-heavy p-4 transition-all ${
                    company.is_active ? "border-border/30" : "border-destructive/30 bg-destructive/5"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    {/* Logo */}
                    <div className="w-12 h-12 rounded-2xl overflow-hidden bg-primary/10 flex items-center justify-center shrink-0">
                      {company.logo_url
                        ? <img src={company.logo_url} alt="" className="w-full h-full object-cover" />
                        : <Building2 className="w-6 h-6 text-primary/40" />
                      }
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm">{company.name}</p>
                        <Badge className={`text-[10px] px-2 py-0 rounded-full ${
                          company.is_active
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                        }`}>
                          {company.is_active ? "Active" : "Suspended"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        <span className="text-xs font-mono text-muted-foreground">{company.company_code}</span>
                        {company.industry && <span className="text-xs text-muted-foreground">{company.industry}</span>}
                        <span className="text-xs text-muted-foreground">{company.member_count} member{company.member_count !== 1 ? "s" : ""}</span>
                        {company.admin_email && <span className="text-xs text-muted-foreground font-mono">Owner: {company.admin_email}</span>}
                      </div>
                      {!company.is_active && company.suspended_reason && (
                        <p className="text-xs text-destructive mt-1">Suspension Reason: {company.suspended_reason}</p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Super Admin Edit Company Details */}
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-xl gap-1.5 text-xs"
                        onClick={() => {
                          setEditCompanyTarget(company);
                          setEditName(company.name);
                          setEditIndustry(company.industry || "");
                          setEditAddress(company.address || "");
                        }}
                      >
                        <Pencil className="w-3.5 h-3.5" /> Edit
                      </Button>

                      {/* Suspend / Restore */}
                      {company.is_active ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-xl gap-1.5 text-amber-600 border-amber-200 hover:bg-amber-50 dark:hover:bg-amber-950/20 text-xs"
                          onClick={() => { setSuspendTarget(company); setSuspendReason(""); }}
                        >
                          <Ban className="w-3.5 h-3.5" /> Suspend
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-xl gap-1.5 text-green-600 border-green-200 hover:bg-green-50 dark:hover:bg-green-950/20 text-xs"
                          onClick={() => handleToggleAccess(company)}
                        >
                          <RotateCcw className="w-3.5 h-3.5" /> Restore
                        </Button>
                      )}

                      {/* Delete */}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="w-8 h-8 rounded-xl text-destructive hover:bg-destructive/10">
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="rounded-3xl">
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete "{company.name}"?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete the company, its workers, checklists, attendance records, and project files.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              onClick={() => handleDeleteCompany(company)}
                            >
                              Delete Forever
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </TabsContent>

          {/* ── Users Tab with Quota Management ──────────────────────────── */}
          <TabsContent value="users" className="mt-4 space-y-3">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 rounded-3xl bg-muted/40 animate-pulse" />
              ))
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">No users found</div>
            ) : (
              filteredUsers.map(user => (
                <div key={user.user_id} className="rounded-3xl border border-border/30 glass-heavy p-4 flex items-center gap-4">
                  <Avatar className="w-10 h-10 border border-border/30">
                    <AvatarImage src={user.photo_url || undefined} />
                    <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">
                      {(user.full_name || user.email).split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm truncate">{user.full_name || "—"}</p>
                      {user.is_super_admin && (
                        <Badge className="text-[10px] px-2 py-0 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 gap-1">
                          <Crown className="w-2.5 h-2.5" /> Super Admin
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground font-mono">{user.email}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span>Joined {user.company_count} company/ies</span>
                      <span>•</span>
                      <span>Allowed to create: <strong className="text-foreground">{user.max_companies_allowed ?? 5}</strong> companies</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl gap-1.5 text-xs"
                      onClick={() => {
                        setQuotaUserTarget(user);
                        setQuotaValue(user.max_companies_allowed ?? 5);
                      }}
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5" /> Set Quota
                    </Button>
                  </div>
                </div>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit Company Dialog */}
      <Dialog open={!!editCompanyTarget} onOpenChange={() => setEditCompanyTarget(null)}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle>Edit Company Details (Super Admin)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Company Name</Label>
              <Input
                value={editName}
                onChange={e => setEditName(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Industry</Label>
              <Input
                value={editIndustry}
                onChange={e => setEditIndustry(e.target.value)}
                placeholder="e.g. Construction"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Address</Label>
              <Textarea
                value={editAddress}
                onChange={e => setEditAddress(e.target.value)}
                rows={2}
                className="rounded-xl"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setEditCompanyTarget(null)}>Cancel</Button>
            <Button className="rounded-xl gap-1.5" onClick={handleSaveCompanyEdit}>
              <Save className="w-4 h-4" /> Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Set User Quota Dialog */}
      <Dialog open={!!quotaUserTarget} onOpenChange={() => setQuotaUserTarget(null)}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle>Set Company Creation Limit</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Configure how many companies <strong>{quotaUserTarget?.email}</strong> is allowed to create on the platform.
            </p>
            <div className="space-y-1.5">
              <Label>Max Companies Allowed</Label>
              <Input
                type="number"
                min="0"
                max="1000"
                value={quotaValue}
                onChange={e => setQuotaValue(parseInt(e.target.value) || 0)}
                className="rounded-xl"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setQuotaUserTarget(null)}>Cancel</Button>
            <Button className="rounded-xl gap-1.5" onClick={handleSaveUserQuota}>
              <Save className="w-4 h-4" /> Update Limit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Suspend dialog */}
      <Dialog open={!!suspendTarget} onOpenChange={() => { setSuspendTarget(null); setSuspendReason(""); }}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle>Suspend "{suspendTarget?.name}"?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label>Reason (shown to the company)</Label>
            <Textarea
              value={suspendReason}
              onChange={e => setSuspendReason(e.target.value)}
              placeholder="e.g. Subscription expired. Please renew to continue."
              rows={3}
              className="rounded-xl"
            />
            <p className="text-xs text-muted-foreground">
              All users in this company will see an "Access Suspended" screen with this reason and your contact details.
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setSuspendTarget(null)}>Cancel</Button>
            <Button
              className="rounded-xl bg-amber-600 hover:bg-amber-700 text-white gap-2"
              onClick={() => suspendTarget && handleToggleAccess(suspendTarget, suspendReason)}
            >
              <Ban className="w-4 h-4" /> Suspend Access
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
