import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { useCompanyContext } from "@/context/CompanyContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Navbar } from "@/components/Navbar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Building2, Users, Link2, Camera, RefreshCw, Copy, Check,
  Crown, Shield, UserCog, HardHat, Trash2, Save, ArrowLeft,
  QrCode, Eye, EyeOff, Settings2, UserX, ChevronDown, Upload
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Member {
  user_id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  role: string;
  is_active: boolean;
  joined_at: string;
}

const INDUSTRIES = [
  "Construction", "Prefab / Precast", "Manufacturing", "Real Estate",
  "Infrastructure", "Mining", "Oil & Gas", "Technology",
  "Healthcare", "Education", "Retail", "Hospitality", "Other",
];

const ROLE_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  admin:      { label: "Admin",      icon: Crown,    color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  management: { label: "Management", icon: Shield,    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  supervisor: { label: "Supervisor", icon: UserCog,   color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
  worker:     { label: "Worker",     icon: HardHat,   color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
};

// ── Main page ─────────────────────────────────────────────────────────────────
export default function CompanySettings() {
  const navigate = useNavigate();
  const { activeCompany, refreshCompanies } = useCompanyContext();
  const { role: myRole } = useUserRole();
  const isAdmin = myRole === "admin";

  if (!activeCompany) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">No company selected.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-xl">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Settings2 className="w-6 h-6 text-primary" />
              Company Settings
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Manage <span className="font-medium text-foreground">{activeCompany.name}</span>
            </p>
          </div>
        </div>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="glass-heavy rounded-2xl p-1 h-auto gap-1">
            <TabsTrigger value="profile"  className="rounded-xl gap-2 px-4 py-2"><Building2 className="w-4 h-4" />Profile</TabsTrigger>
            <TabsTrigger value="members"  className="rounded-xl gap-2 px-4 py-2"><Users className="w-4 h-4" />Team</TabsTrigger>
            <TabsTrigger value="invite"   className="rounded-xl gap-2 px-4 py-2"><Link2 className="w-4 h-4" />Join & Invite</TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <ProfileTab company={activeCompany} isAdmin={isAdmin} onSaved={refreshCompanies} />
          </TabsContent>
          <TabsContent value="members">
            <MembersTab companyId={activeCompany.id} isAdmin={isAdmin} myRole={myRole || ""} />
          </TabsContent>
          <TabsContent value="invite">
            <InviteTab company={activeCompany} isAdmin={isAdmin} onRegenerated={refreshCompanies} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// ── Profile Tab ───────────────────────────────────────────────────────────────
function ProfileTab({ company, isAdmin, onSaved }: { company: any; isAdmin: boolean; onSaved: () => void }) {
  const [name, setName]         = useState(company.name || "");
  const [industry, setIndustry] = useState(company.industry || "");
  const [address, setAddress]   = useState(company.address || "");
  const [logoUrl, setLogoUrl]   = useState(company.logo_url || "");
  const [saving, setSaving]     = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error("Logo must be under 2 MB"); return; }

    setUploading(true);
    try {
      const ext  = file.name.split(".").pop();
      const path = `${company.id}/logo.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("company-logos")
        .upload(path, file, { upsert: true });
      if (upErr) throw upErr;

      const { data: { publicUrl } } = supabase.storage
        .from("company-logos")
        .getPublicUrl(path);

      setLogoUrl(publicUrl + "?t=" + Date.now());
      toast.success("Logo uploaded — click Save to apply");
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) { toast.error("Company name is required"); return; }
    setSaving(true);
    try {
      const { error } = await (supabase.rpc as any)("update_company_details", {
        p_company_id: company.id,
        p_name:       name.trim(),
        p_industry:   industry || null,
        p_address:    address  || null,
        p_logo_url:   logoUrl  || null,
      });
      if (error) throw error;
      onSaved();
      toast.success("Company profile saved!");
    } catch (err: any) {
      toast.error(err.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <Card className="rounded-3xl border-border/30 glass-heavy">
        <CardHeader>
          <CardTitle className="text-base">Company Identity</CardTitle>
          <CardDescription>Your logo and basic information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Logo upload */}
          <div className="flex items-center gap-6">
            <div className="relative group">
              <div className="w-24 h-24 rounded-2xl overflow-hidden bg-primary/10 border-2 border-border/30 flex items-center justify-center">
                {logoUrl
                  ? <img src={logoUrl} alt="Company logo" className="w-full h-full object-cover" />
                  : <Building2 className="w-10 h-10 text-primary/40" />
                }
              </div>
              {isAdmin && (
                <>
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="absolute inset-0 rounded-2xl bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                  >
                    {uploading
                      ? <div className="w-5 h-5 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                      : <Camera className="w-6 h-6 text-white" />
                    }
                  </button>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                </>
              )}
            </div>
            <div>
              <p className="font-semibold text-lg">{name || "Your Company"}</p>
              <p className="text-xs text-muted-foreground mt-1">Company Code: <span className="font-mono font-bold text-primary">{company.company_code}</span></p>
              {isAdmin && (
                <Button variant="outline" size="sm" className="mt-2 rounded-xl gap-2" onClick={() => fileRef.current?.click()}>
                  <Upload className="w-3.5 h-3.5" /> Upload Logo
                </Button>
              )}
            </div>
          </div>

          <Separator />

          {/* Fields */}
          <div className="grid gap-4">
            <div className="space-y-1.5">
              <Label>Company Name <span className="text-destructive">*</span></Label>
              <Input
                value={name}
                onChange={e => setName(e.target.value)}
                disabled={!isAdmin}
                placeholder="e.g. FUSIONest Private Limited"
                className="rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Industry</Label>
              <Select value={industry} onValueChange={setIndustry} disabled={!isAdmin}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Select industry" />
                </SelectTrigger>
                <SelectContent>
                  {INDUSTRIES.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Address / Location</Label>
              <Textarea
                value={address}
                onChange={e => setAddress(e.target.value)}
                disabled={!isAdmin}
                placeholder="Office address..."
                rows={3}
                className="rounded-xl resize-none"
              />
            </div>
          </div>

          {isAdmin && (
            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={saving} className="rounded-xl gap-2 px-6">
                {saving
                  ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <Save className="w-4 h-4" />
                }
                Save Changes
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Read-only info */}
      <Card className="rounded-3xl border-border/30 glass-heavy">
        <CardHeader>
          <CardTitle className="text-base">Company Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          {[
            { label: "Company Code", value: company.company_code },
            { label: "Industry",     value: company.industry || "—" },
            { label: "Created",      value: new Date(company.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) },
            { label: "Your Role",    value: "Admin" },
          ].map(({ label, value }) => (
            <div key={label} className="space-y-0.5">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="font-medium text-sm">{value}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Danger Zone: Delete Company */}
      {isAdmin && (
        <Card className="rounded-3xl border-destructive/30 bg-destructive/5 glass-heavy">
          <CardHeader>
            <CardTitle className="text-base text-destructive flex items-center gap-2">
              <Trash2 className="w-4 h-4" /> Danger Zone
            </CardTitle>
            <CardDescription>
              Permanently delete this company and all its projects, workers, and attendance records.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">Delete "{company.name}"</p>
              <p className="text-xs text-muted-foreground">Once deleted, your company workspace cannot be recovered.</p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" className="rounded-xl gap-1.5">
                  <Trash2 className="w-3.5 h-3.5" /> Delete Company
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="rounded-3xl">
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete <strong>{company.name}</strong> along with all associated workers, checklists, attendance records, and project files.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="rounded-xl bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                    onClick={async () => {
                      try {
                        const { error } = await (supabase.rpc as any)("delete_own_company", { p_company_id: company.id });
                        if (error) throw error;
                        toast.success(`Company "${company.name}" deleted.`);
                        window.location.href = "/onboarding";
                      } catch (e: any) {
                        toast.error(e.message || "Failed to delete company");
                      }
                    }}
                  >
                    Yes, Delete Forever
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}

// ── Members Tab ───────────────────────────────────────────────────────────────
function MembersTab({ companyId, isAdmin, myRole }: { companyId: string; isAdmin: boolean; myRole: string }) {
  const [members, setMembers]   = useState<Member[]>([]);
  const [loading, setLoading]   = useState(true);
  const [myUserId, setMyUserId] = useState<string>("");
  const [search, setSearch]     = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setMyUserId(user.id);
    });
    loadMembers();
  }, [companyId]);

  const loadMembers = async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase.rpc as any)("get_company_members", { p_company_id: companyId });
      if (error) throw error;
      setMembers(data || []);
    } catch (err: any) {
      toast.error("Failed to load members: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      const { error } = await (supabase.rpc as any)("update_member_role", {
        p_company_id: companyId,
        p_user_id:    userId,
        p_new_role:   newRole,
      });
      if (error) throw error;
      setMembers(prev => prev.map(m => m.user_id === userId ? { ...m, role: newRole } : m));
      toast.success("Role updated");
    } catch (err: any) {
      toast.error(err.message || "Failed to update role");
    }
  };

  const handleRemove = async (userId: string, name: string) => {
    try {
      const { error } = await (supabase.rpc as any)("remove_company_member", {
        p_company_id: companyId,
        p_user_id:    userId,
      });
      if (error) throw error;
      setMembers(prev => prev.filter(m => m.user_id !== userId));
      toast.success(`${name} removed from company`);
    } catch (err: any) {
      toast.error(err.message || "Failed to remove member");
    }
  };

  const filtered = members.filter(m =>
    m.full_name.toLowerCase().includes(search.toLowerCase()) ||
    m.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <Card className="rounded-3xl border-border/30 glass-heavy">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Team Members</CardTitle>
              <CardDescription>{members.length} member{members.length !== 1 ? "s" : ""} in this company</CardDescription>
            </div>
            <Button variant="outline" size="sm" className="rounded-xl gap-2" onClick={loadMembers}>
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </Button>
          </div>
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="rounded-xl mt-2"
          />
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 rounded-2xl bg-muted/40 animate-pulse" />
            ))
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">No members found</div>
          ) : (
            filtered.map(member => {
              const rc    = ROLE_CONFIG[member.role] || ROLE_CONFIG.worker;
              const RIcon = rc.icon;
              const isMe  = member.user_id === myUserId;
              return (
                <div key={member.user_id} className="flex items-center gap-3 p-3 rounded-2xl bg-muted/20 hover:bg-muted/40 transition-colors">
                  <Avatar className="w-10 h-10 border border-border/30">
                    <AvatarImage src={member.avatar_url || undefined} />
                    <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">
                      {member.full_name.split(" ").map(n => n[0]).join("").substring(0, 2)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="font-medium text-sm truncate">{member.full_name}</p>
                      {isMe && <Badge variant="outline" className="text-[10px] px-1.5 py-0">You</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Role badge / selector */}
                    {isAdmin && !isMe ? (
                      <Select value={member.role} onValueChange={v => handleRoleChange(member.user_id, v)}>
                        <SelectTrigger className={`h-7 text-xs rounded-xl border-0 font-medium gap-1 px-2.5 ${rc.color}`}>
                          <RIcon className="w-3 h-3" />
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(ROLE_CONFIG).map(([val, cfg]) => (
                            <SelectItem key={val} value={val}>
                              <div className="flex items-center gap-2">
                                <cfg.icon className="w-3.5 h-3.5" />
                                {cfg.label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge className={`text-xs rounded-xl gap-1 border-0 ${rc.color}`}>
                        <RIcon className="w-3 h-3" />
                        {rc.label}
                      </Badge>
                    )}

                    {/* Remove button */}
                    {(isAdmin && !isMe) && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="w-7 h-7 rounded-lg text-destructive hover:bg-destructive/10">
                            <UserX className="w-3.5 h-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="rounded-3xl">
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove {member.full_name}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              They will lose access to this company. This cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              className="rounded-xl bg-destructive text-destructive-foreground"
                              onClick={() => handleRemove(member.user_id, member.full_name)}
                            >
                              Remove
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Role legend */}
      <Card className="rounded-3xl border-border/30 glass-heavy">
        <CardHeader>
          <CardTitle className="text-sm">Role Permissions</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          {[
            { role: "admin",      desc: "Full access — manage company, members, all data" },
            { role: "management", desc: "View all reports, attendance, projects" },
            { role: "supervisor", desc: "Manage assigned workers, mark attendance" },
            { role: "worker",     desc: "View personal attendance & assignments" },
          ].map(({ role, desc }) => {
            const rc    = ROLE_CONFIG[role];
            const RIcon = rc.icon;
            return (
              <div key={role} className={`p-3 rounded-2xl ${rc.color}`}>
                <div className="flex items-center gap-1.5 mb-1">
                  <RIcon className="w-3.5 h-3.5" />
                  <span className="text-xs font-bold">{rc.label}</span>
                </div>
                <p className="text-[11px] opacity-80">{desc}</p>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ── Invite Tab ────────────────────────────────────────────────────────────────
function InviteTab({ company, isAdmin, onRegenerated }: { company: any; isAdmin: boolean; onRegenerated: () => void }) {
  const [joinCode, setJoinCode]   = useState(company.join_code || "");
  const [copied, setCopied]       = useState(false);
  const [showCode, setShowCode]   = useState(true);
  const [regenerating, setRegen]  = useState(false);

  const shareUrl = `${window.location.origin}/onboarding?join=${joinCode}`;
  const qrUrl    = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(shareUrl)}&bgcolor=ffffff&color=0d9488&margin=10`;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success(`${label} copied!`);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRegenerate = async () => {
    setRegen(true);
    try {
      const { data, error } = await (supabase.rpc as any)("regenerate_join_code", { p_company_id: company.id });
      if (error) throw error;
      setJoinCode(data);
      onRegenerated();
      toast.success("New join code generated");
    } catch (err: any) {
      toast.error(err.message || "Failed to regenerate");
    } finally {
      setRegen(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Join code card */}
      <Card className="rounded-3xl border-border/30 glass-heavy">
        <CardHeader>
          <CardTitle className="text-base">6-Digit Join Code</CardTitle>
          <CardDescription>Share this code with team members to join your company</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Code display */}
          <div className="flex items-center justify-center gap-2 py-6">
            {showCode ? (
              <div className="flex gap-2">
                {joinCode.split("").map((digit, i) => (
                  <div
                    key={i}
                    className="w-12 h-14 rounded-2xl bg-primary/10 border-2 border-primary/20 flex items-center justify-center text-2xl font-bold text-primary font-mono"
                  >
                    {digit}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex gap-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="w-12 h-14 rounded-2xl bg-muted/40 flex items-center justify-center text-2xl text-muted-foreground">•</div>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button variant="outline" size="sm" className="rounded-xl gap-2" onClick={() => setShowCode(!showCode)}>
              {showCode ? <><EyeOff className="w-3.5 h-3.5" /> Hide</> : <><Eye className="w-3.5 h-3.5" /> Show</>}
            </Button>
            <Button variant="outline" size="sm" className="rounded-xl gap-2" onClick={() => copyToClipboard(joinCode, "Join code")}>
              {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
              Copy Code
            </Button>
            {isAdmin && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="rounded-xl gap-2 text-amber-600 border-amber-200 hover:bg-amber-50" disabled={regenerating}>
                    <RefreshCw className={`w-3.5 h-3.5 ${regenerating ? "animate-spin" : ""}`} />
                    New Code
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="rounded-3xl">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Regenerate Join Code?</AlertDialogTitle>
                    <AlertDialogDescription>
                      The old code will stop working. Anyone who hasn't joined yet will need the new code.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                    <AlertDialogAction className="rounded-xl" onClick={handleRegenerate}>
                      Regenerate
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </CardContent>
      </Card>

      {/* QR Code card */}
      <Card className="rounded-3xl border-border/30 glass-heavy">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <QrCode className="w-4 h-4 text-primary" /> QR Code Invite
          </CardTitle>
          <CardDescription>Scan to open the join page with code pre-filled</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          <div className="p-3 bg-white rounded-3xl shadow-lg border border-border/20">
            <img src={qrUrl} alt="Join QR Code" className="w-44 h-44 rounded-xl" />
          </div>
          <p className="text-xs text-muted-foreground text-center max-w-xs">
            This QR code links to your company's join page. Print it and post it on site for easy onboarding.
          </p>
        </CardContent>
      </Card>

      {/* Share link */}
      <Card className="rounded-3xl border-border/30 glass-heavy">
        <CardHeader>
          <CardTitle className="text-base">Shareable Link</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Input value={shareUrl} readOnly className="rounded-xl font-mono text-xs text-muted-foreground" />
          <Button variant="outline" className="rounded-xl gap-2 shrink-0" onClick={() => copyToClipboard(shareUrl, "Invite link")}>
            <Copy className="w-4 h-4" /> Copy
          </Button>
        </CardContent>
      </Card>

      {/* Company code */}
      <Card className="rounded-3xl border-border/30 glass-heavy bg-primary/5">
        <CardContent className="pt-6 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Company Code (permanent ID)</p>
            <p className="font-mono font-bold text-xl text-primary mt-1">{company.company_code}</p>
          </div>
          <Button variant="ghost" size="sm" className="rounded-xl gap-2" onClick={() => copyToClipboard(company.company_code, "Company code")}>
            <Copy className="w-3.5 h-3.5" /> Copy
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}
