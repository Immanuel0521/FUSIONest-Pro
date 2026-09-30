import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { useCompanyContext } from "@/context/CompanyContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Building2, Users, QrCode, ArrowRight, ArrowLeft,
  Check, Loader2, Camera, Hash, Globe, MapPin,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────
type Step = "choice" | "create" | "join" | "join-confirm" | "done";

interface FoundCompany {
  id: string;
  name: string;
  company_code: string;
  join_code: string;
  industry: string | null;
  member_count: number;
}

const INDUSTRIES = [
  "Construction", "Prefab / Precast", "Infrastructure", "Real Estate",
  "Manufacturing", "Logistics", "Engineering", "Mining", "Other",
];

const slide = {
  initial: { opacity: 0, x: 32 },
  animate: { opacity: 1, x: 0 },
  exit:    { opacity: 0, x: -32 },
  transition: { duration: 0.22 },
};

// ── Main component ─────────────────────────────────────────────────────────────
export function OnboardingFlow() {
  const navigate = useNavigate();
  const { refreshCompanies, memberships, activeCompany, userRole } = useCompanyContext();
  const [step, setStep] = useState<Step>("choice");
  const [loading, setLoading] = useState(false);

  // If user already has companies and visits /onboarding directly without query params, they can go back
  const hasExistingCompany = memberships.length > 0;

  // Only admins can create or add a secondary company
  useEffect(() => {
    if (hasExistingCompany && userRole && userRole !== "admin") {
      toast.error("Only administrators have permission to create or add secondary companies.");
      navigate("/dashboard", { replace: true });
    }
  }, [hasExistingCompany, userRole, navigate]);

  // Create form
  const [companyName, setCompanyName] = useState("");
  const [industry, setIndustry]       = useState("");
  const [address, setAddress]         = useState("");

  // Join form
  const [joinCode, setJoinCode]         = useState("");
  const [foundCompany, setFoundCompany] = useState<FoundCompany | null>(null);
  const [joinRole, setJoinRole]         = useState<string>("supervisor");

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const currentUser = async () => {
    // Use getSession first to ensure token is refreshed, then getUser
    await supabase.auth.getSession();
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  };

  // ── Create company ───────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (hasExistingCompany && userRole !== "admin") {
      toast.error("Only administrators can create additional companies.");
      return;
    }
    if (!companyName.trim()) { toast.error("Company name is required"); return; }
    setLoading(true);
    try {
      // Validate session explicitly before any DB call
      const { data: { session }, error: sessErr } = await supabase.auth.getSession();
      if (sessErr || !session) {
        toast.error("Session expired — please log in again.");
        await supabase.auth.signOut();
        navigate("/");
        return;
      }

      // Use SECURITY DEFINER RPC — bypasses all RLS issues, validates auth server-side
      const { data: company, error: cErr } = await (supabase.rpc as any)(
        "create_company_for_user",
        {
          p_name:     companyName.trim(),
          p_industry: industry || null,
          p_address:  address || null,
        }
      );

      if (cErr) throw cErr;

      await refreshCompanies();
      toast.success(`Company "${company.name}" created! Your Join Code: ${company.join_code}`);
      navigate("/dashboard");
    } catch (e: any) {
      toast.error(e.message || "Failed to create company");
    } finally {
      setLoading(false);
    }
  };

  // ── Look up company by join code ─────────────────────────────────────────────
  const handleLookup = async () => {
    const code = joinCode.trim().replace(/\D/g, "");
    if (code.length !== 6) { toast.error("Enter a valid 6-digit join code"); return; }
    setLoading(true);
    try {
      const { data, error } = await (supabase
        .rpc as any)("get_company_by_join_code", { p_join_code: code });
      if (error) throw error;
      if (!data || data.length === 0) {
        toast.error("No company found with that code. Double-check and try again.");
        setLoading(false);
        return;
      }
      setFoundCompany(data[0] as FoundCompany);
      setStep("join-confirm");
    } catch (e: any) {
      toast.error(e.message || "Lookup failed");
    } finally {
      setLoading(false);
    }
  };

  // ── Confirm join ─────────────────────────────────────────────────────────────
  const handleJoin = async () => {
    if (hasExistingCompany && userRole !== "admin") {
      toast.error("Only administrators can join additional companies.");
      return;
    }
    if (!foundCompany) return;
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Session expired — please log in again.");
        navigate("/");
        return;
      }

      // Use SECURITY DEFINER RPC — bypasses all RLS issues
      const { error: mErr } = await (supabase.rpc as any)(
        "join_company_for_user",
        { p_join_code: foundCompany.join_code, p_role: joinRole }
      );
      if (mErr) throw mErr;

      await refreshCompanies();
      toast.success(`Joined "${foundCompany.name}" as ${joinRole}`);
      navigate("/dashboard");
    } catch (e: any) {
      toast.error(e.message || "Failed to join company");
    } finally {
      setLoading(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary/30 to-background p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            <span className="text-primary">FUSION</span>
            <span className="text-foreground">est Pro</span>
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">Set up your workspace to get started</p>
        </div>

        <AnimatePresence mode="wait">
          {/* ── CHOICE ── */}
          {step === "choice" && (
            <motion.div key="choice" {...slide} className="space-y-4">
              <h2 className="text-xl font-semibold text-center mb-6">Welcome! What would you like to do?</h2>
              <Card
                className="p-5 border-2 border-transparent hover:border-primary/40 cursor-pointer transition-all group"
                onClick={() => setStep("create")}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <Building2 className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold">Create a Company</p>
                    <p className="text-sm text-muted-foreground">Set up your organisation and invite your team</p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </Card>

              <Card
                className="p-5 border-2 border-transparent hover:border-primary/40 cursor-pointer transition-all group"
                onClick={() => setStep("join")}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center group-hover:bg-accent/20 transition-colors">
                    <Users className="w-6 h-6 text-accent" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold">Join a Company</p>
                    <p className="text-sm text-muted-foreground">Enter a 6-digit join code or scan a QR</p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </Card>

              {hasExistingCompany && (
                <div className="pt-2 text-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-xl text-muted-foreground hover:text-foreground gap-1.5"
                    onClick={() => navigate("/dashboard")}
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back to {activeCompany?.name || "Dashboard"}
                  </Button>
                </div>
              )}
            </motion.div>
          )}

          {/* ── CREATE ── */}
          {step === "create" && (
            <motion.div key="create" {...slide} className="space-y-5">
              <div className="flex items-center gap-3 mb-2">
                <button
                  onClick={() => setStep("choice")}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <h2 className="text-xl font-semibold">Create Company</h2>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Company Name <span className="text-destructive">*</span></Label>
                  <Input
                    placeholder="e.g. Apex Construction Pvt Ltd"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Industry</Label>
                  <select
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                  >
                    <option value="">Select industry…</option>
                    {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label>Address / Location</Label>
                  <Input
                    placeholder="e.g. Mumbai, Maharashtra"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                </div>
              </div>

              <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-1">What happens next?</p>
                <ul className="space-y-1 text-xs">
                  <li>✅ A unique <strong>Company ID</strong> (e.g. FUS-A1B2C3) is generated</li>
                  <li>✅ A <strong>6-digit Join Code</strong> is created for inviting people</li>
                  <li>✅ You become the <strong>Admin</strong> of the company</li>
                </ul>
              </div>

              <Button
                className="w-full"
                disabled={loading || !companyName.trim()}
                onClick={handleCreate}
              >
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
                Create Company
              </Button>
            </motion.div>
          )}

          {/* ── JOIN ── */}
          {step === "join" && (
            <motion.div key="join" {...slide} className="space-y-5">
              <div className="flex items-center gap-3 mb-2">
                <button
                  onClick={() => setStep("choice")}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <h2 className="text-xl font-semibold">Join a Company</h2>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Hash className="w-4 h-4" /> 6-Digit Join Code
                </Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g. 482931"
                    maxLength={6}
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, ""))}
                    className="text-xl tracking-[0.4em] text-center font-mono"
                  />
                  <Button
                    onClick={handleLookup}
                    disabled={loading || joinCode.length !== 6}
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Find"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Ask your Admin for the 6-digit join code.
                </p>
              </div>

              {/* QR hint */}
              <div className="text-center text-xs text-muted-foreground">
                <span>— or —</span>
              </div>
              <div className="rounded-xl border border-dashed border-border p-4 flex flex-col items-center gap-2 text-muted-foreground">
                <QrCode className="w-8 h-8 opacity-40" />
                <p className="text-sm font-medium">Scan QR Code</p>
                <p className="text-xs text-center">Ask your Admin to show the company QR code, then scan with your phone camera. The join code will fill automatically.</p>
              </div>
            </motion.div>
          )}

          {/* ── JOIN CONFIRM ── */}
          {step === "join-confirm" && foundCompany && (
            <motion.div key="join-confirm" {...slide} className="space-y-5">
              <div className="flex items-center gap-3 mb-2">
                <button
                  onClick={() => { setStep("join"); setFoundCompany(null); }}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <h2 className="text-xl font-semibold">Confirm & Join</h2>
              </div>

              {/* Company card */}
              <Card className="p-4 border-2 border-primary/30 bg-primary/5">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-bold text-lg">{foundCompany.name}</p>
                    <div className="flex items-center gap-2 flex-wrap mt-0.5">
                      <Badge variant="outline" className="text-xs">{foundCompany.company_code}</Badge>
                      {foundCompany.industry && <Badge variant="secondary" className="text-xs">{foundCompany.industry}</Badge>}
                      <span className="text-xs text-muted-foreground">{foundCompany.member_count} member{foundCompany.member_count !== 1 ? "s" : ""}</span>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Role selection */}
              <div className="space-y-2">
                <Label>Joining as</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(["management", "supervisor", "worker"] as const).map((r) => (
                    <button
                      key={r}
                      onClick={() => setJoinRole(r)}
                      className={`p-3 rounded-xl border-2 text-sm font-medium capitalize transition-all ${
                        joinRole === r
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:border-primary/40"
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">The Admin can change your role later.</p>
              </div>

              <Button
                className="w-full"
                disabled={loading}
                onClick={handleJoin}
              >
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
                Join {foundCompany.name}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
