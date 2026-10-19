import { Link } from "react-router-dom";
import { 
  ShieldCheck, 
  Lock, 
  Globe, 
  Activity, 
  FileText, 
  Users, 
  FolderKanban, 
  FileBarChart, 
  Sparkles,
  CheckCircle2,
  ExternalLink,
  Crown
} from "lucide-react";
import logo from "@/assets/fusionest-logo.png";
import { Badge } from "@/components/ui/badge";
import { useCompanyContext } from "@/context/CompanyContext";

export const Footer = () => {
  const currentYear = new Date().getFullYear();
  const { activeCompany } = useCompanyContext();
  const isFusionest = Boolean(
    activeCompany &&
    activeCompany.name.toLowerCase().includes("fusionest")
  );

  return (
    <footer className="relative z-10 border-t border-border/40 bg-card/40 backdrop-blur-md mt-auto mb-16 lg:mb-0">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-6">
          {/* Brand & Mission */}
          <div className="lg:col-span-2 space-y-4">
            <Link to="/dashboard" className="flex items-center gap-2.5 group w-fit">
              {isFusionest ? (
                <>
                  <img
                    src={logo}
                    alt="FUSIONest Pro Logo"
                    className="w-8 h-8 rounded-xl shadow-sm border border-primary/20 object-contain"
                  />
                  <span 
                    className="font-bold text-lg tracking-tight group-hover:text-primary transition-colors" 
                    style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                  >
                    FUSIONest Pro
                  </span>
                </>
              ) : (
                <>
                  {activeCompany?.logo_url ? (
                    <img
                      src={activeCompany.logo_url}
                      alt={activeCompany.name}
                      className="w-8 h-8 rounded-xl shadow-sm border border-primary/20 object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-xl bg-primary/15 text-primary border border-primary/30 flex items-center justify-center font-bold text-xs uppercase shadow-sm">
                      {activeCompany?.name ? activeCompany.name.slice(0, 2) : "CO"}
                    </div>
                  )}
                  <span 
                    className="font-bold text-lg tracking-tight group-hover:text-primary transition-colors truncate max-w-[220px]" 
                    style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                    title={activeCompany?.name}
                  >
                    {activeCompany?.name || "Company"}
                  </span>
                </>
              )}
            </Link>

            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-sm">
              {isFusionest
                ? "Next-generation workforce intelligence platform combining AI-driven multi-angle facial biometrics, geofenced shift logging, and civil engineering Daily Progress Reports (DPR)."
                : `Enterprise workforce intelligence, biometric shift logging, and civil engineering Daily Progress Reports (DPR) for ${activeCompany?.name || "your organization"}.`}
            </p>

            {/* Compliance Pills */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20 gap-1 py-0.5">
                <ShieldCheck className="w-3 h-3" /> DPDP Act 2023 Compliant
              </Badge>
              <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 gap-1 py-0.5">
                <Lock className="w-3 h-3" /> 256-Bit SSL Enforced
              </Badge>
            </div>
          </div>

          {/* Quick Operations */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground/90" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Workforce &amp; Time
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link to="/dashboard" className="text-muted-foreground hover:text-primary transition-colors">
                  Executive Dashboard
                </Link>
              </li>
              <li>
                <Link to="/workforce" className="text-muted-foreground hover:text-primary transition-colors">
                  Workforce Roster
                </Link>
              </li>
              <li>
                <Link to="/workforce?tab=attendance" className="text-muted-foreground hover:text-primary transition-colors">
                  Live Attendance &amp; Groups
                </Link>
              </li>
              <li>
                <Link to="/attendance-history" className="text-muted-foreground hover:text-primary transition-colors">
                  Attendance Audit History
                </Link>
              </li>
              <li>
                <Link to="/workforce?tab=biometrics" className="text-muted-foreground hover:text-primary transition-colors">
                  Face Biometrics Registration
                </Link>
              </li>
            </ul>
          </div>

          {/* Engineering & DPR */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground/90" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Site &amp; Quality
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link to="/projects" className="text-muted-foreground hover:text-primary transition-colors">
                  Site Projects Portfolio
                </Link>
              </li>
              <li>
                <Link to="/dpr" className="text-muted-foreground hover:text-primary transition-colors">
                  DPR Central Management
                </Link>
              </li>
              <li>
                <Link to="/stage-standards" className="text-muted-foreground hover:text-primary transition-colors">
                  Execution Quality Standards
                </Link>
              </li>
              <li>
                <Link to="/my-checklists" className="text-muted-foreground hover:text-primary transition-colors">
                  Quality &amp; Safety Checklists
                </Link>
              </li>
              <li>
                <Link to="/reports" className="text-muted-foreground hover:text-primary transition-colors">
                  Reports &amp; Payroll Computation
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal, Security & Systems */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground/90" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Governance &amp; Trust
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link to="/privacy" className="text-muted-foreground hover:text-primary transition-colors">
                  Privacy Policy &amp; Biometrics
                </Link>
              </li>
              <li>
                <Link to="/terms" className="text-muted-foreground hover:text-primary transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link to="/sitemap" className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 font-semibold text-primary">
                  HTML Sitemap <ExternalLink className="w-2.5 h-2.5" />
                </Link>
              </li>
              <li>
                <Link to="/company-settings" className="text-muted-foreground hover:text-primary transition-colors">
                  Company Settings &amp; Access
                </Link>
              </li>
              <li>
                <Link to="/super-admin" className="text-muted-foreground hover:text-amber-500 transition-colors flex items-center gap-1">
                  <Crown className="w-3 h-3 text-amber-500" /> Platform Super Admin
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar: Status & Copyright */}
        <div className="mt-8 pt-6 border-t border-border/30 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              All Systems Operational
            </span>
            <span className="text-border">•</span>
            <span className="font-mono text-[11px] text-foreground/60">v2.4.0-pro</span>
          </div>

          <p className="text-center sm:text-right">
            &copy; {currentYear} {isFusionest ? "FUSIONest Pro. Enterprise Biometrics & Site DPR Management" : `${activeCompany?.name || "Company"}. Powered by Enterprise Workforce SaaS`}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};
