import { useState } from "react";
import { Link } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  FileBarChart,
  Shield,
  History,
  ShieldCheck,
  Building2,
  CalendarCheck,
  Camera,
  ClipboardList,
  Sparkles,
  ArrowRight,
  Search,
  ExternalLink,
  Lock,
  Globe,
  FileText,
  FileCheck2,
  Briefcase,
  Sliders,
  Bell,
  User,
  Crown,
  ChevronRight,
  Home,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import logo from "@/assets/fusionest-logo.png";

interface SitemapSection {
  title: string;
  description: string;
  icon: any;
  color: string;
  links: {
    title: string;
    description: string;
    url: string;
    badge?: string;
    public?: boolean;
  }[];
}

const sitemapSections: SitemapSection[] = [
  {
    title: "Public & Legal",
    description: "Publicly accessible pages, onboarding portals, and legal disclosures.",
    icon: Globe,
    color: "from-blue-500/20 to-cyan-500/20 text-cyan-500",
    links: [
      {
        title: "Platform Sign-In & Workspace Portal",
        description: "Secure login, magic links, and organization access portal.",
        url: "/",
        public: true,
      },
      {
        title: "Privacy Policy & Biometric Consent",
        description: "DPDP Act 2023 disclosures, facial biometric storage, and photo retention terms.",
        url: "/privacy",
        badge: "DPDP Act 2023",
        public: true,
      },
      {
        title: "Terms of Service",
        description: "Enterprise service agreements, subscription guidelines, and security policies.",
        url: "/terms",
        public: true,
      },
      {
        title: "Public Biometric Attendance Kiosk",
        description: "Field tablet scanner for AI face recognition check-in & check-out.",
        url: "/attendance-scan",
        badge: "AI Biometrics",
        public: true,
      },
      {
        title: "HTML Sitemap",
        description: "Structured index of all application modules, tools, and pages.",
        url: "/sitemap",
        public: true,
      },
    ],
  },
  {
    title: "Workforce & Biometrics",
    description: "Personnel management, multi-angle biometric registration, and attendance logging.",
    icon: Users,
    color: "from-emerald-500/20 to-teal-500/20 text-emerald-500",
    links: [
      {
        title: "Workforce Management Hub",
        description: "Complete employee roster, designations, wages, and site assignments.",
        url: "/workforce",
      },
      {
        title: "Live Attendance & Shift Logging",
        description: "Real-time crew check-in, check-out, group attendance, and overtime tracking.",
        url: "/workforce?tab=attendance",
        badge: "Group Fast-Checkin",
      },
      {
        title: "Face Biometrics Engine",
        description: "Multi-angle AI facial enrollment and biometric template validation.",
        url: "/workforce?tab=biometrics",
        badge: "Multi-Angle AI",
      },
      {
        title: "Attendance History & Audit",
        description: "Historical attendance logs, manual override audits, and CSV/Excel exports.",
        url: "/attendance-history",
      },
      {
        title: "Work Allocation History",
        description: "Historical record of labor deployments across project sites.",
        url: "/work-allocation-history",
      },
      {
        title: "Worker Self-Attendance & DPR Contribution",
        description: "Personal attendance ledger and worker daily contribution logs.",
        url: "/worker-attendance",
      },
    ],
  },
  {
    title: "Projects & DPR Engineering",
    description: "Site operations, daily progress reporting, quality standards, and checklists.",
    icon: FolderKanban,
    color: "from-violet-500/20 to-purple-500/20 text-violet-500",
    links: [
      {
        title: "Site Projects Portfolio",
        description: "Active construction projects, milestone trackers, and site metrics.",
        url: "/projects",
      },
      {
        title: "Daily Progress Reports (DPR) Central",
        description: "Unified DPR dashboard, daily site output logs, and materials tracking.",
        url: "/dpr",
        badge: "DPR Hub",
      },
      {
        title: "DPR Overview & Analytics",
        description: "Cross-site aggregate reports, site productivity, and progress timelines.",
        url: "/dpr/overview",
      },
      {
        title: "DPR Review & Supervisor Approvals",
        description: "Managerial sign-off workflow for submitted site daily progress reports.",
        url: "/dpr/review",
        badge: "Approval Workflow",
      },
      {
        title: "Execution Standards & Methodologies",
        description: "Standard operating procedures, construction benchmarks, and technical guidelines.",
        url: "/stage-standards",
      },
      {
        title: "Quality & Safety Checklists",
        description: "Site inspection forms, safety protocols, and compliance verifications.",
        url: "/my-checklists",
      },
    ],
  },
  {
    title: "Executive Analytics & Governance",
    description: "Corporate reporting, payroll computation, company roles, and platform settings.",
    icon: Shield,
    color: "from-amber-500/20 to-orange-500/20 text-amber-500",
    links: [
      {
        title: "Executive Dashboard",
        description: "High-level KPI metrics, workforce velocity charts, and live project health.",
        url: "/dashboard",
        badge: "Live Real-Time",
      },
      {
        title: "Reports & Payroll Analytics",
        description: "Bi-weekly/monthly payroll processing, overtime calculations, and labor costs.",
        url: "/reports",
        badge: "Payroll Engine",
      },
      {
        title: "Company Workspace Settings",
        description: "Company branding, join codes, team invites, and administrative roles.",
        url: "/company-settings",
      },
      {
        title: "Security & User Roles Administration",
        description: "Role-based access control, supervisor assignments, and system permissions.",
        url: "/admin",
      },
      {
        title: "Platform Super Admin Console",
        description: "Multi-tenant tenant management, enterprise subscription quotas, and system health.",
        url: "/super-admin",
        badge: "Restricted",
      },
      {
        title: "User Profile & Security",
        description: "Personal account settings, notification preferences, and password management.",
        url: "/profile",
      },
      {
        title: "Notification Center",
        description: "Real-time alerts, DPR approval requests, and site shift announcements.",
        url: "/notifications",
      },
    ],
  },
];

export default function Sitemap() {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredSections = sitemapSections
    .map((section) => ({
      ...section,
      links: section.links.filter(
        (link) =>
          link.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          link.description.toLowerCase().includes(searchTerm.toLowerCase())
      ),
    }))
    .filter((section) => section.links.length > 0);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top Header */}
      <header className="border-b border-border/40 bg-background/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2.5 group">
            <img src={logo} alt="FUSIONest Pro Logo" className="w-8 h-8 rounded-lg shadow-sm" />
            <div>
              <span className="font-bold text-base tracking-tight group-hover:text-primary transition-colors" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                FUSIONest Pro
              </span>
              <span className="hidden sm:inline-block text-[11px] text-muted-foreground ml-2 px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                Sitemap Index
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm" className="rounded-xl gap-1.5 text-xs">
              <Link to="/dashboard">
                <LayoutDashboard className="w-3.5 h-3.5 text-primary" /> Dashboard
              </Link>
            </Button>
            <Button asChild size="sm" className="rounded-xl gap-1.5 text-xs font-semibold">
              <Link to="/">
                <Home className="w-3.5 h-3.5" /> Portal Home
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex-1 w-full space-y-10">
        {/* Hero Section */}
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <Badge variant="outline" className="rounded-full bg-primary/10 text-primary border-primary/20 px-3 py-1 text-xs font-semibold gap-1.5 shadow-sm">
            <Globe className="w-3.5 h-3.5" /> Complete Platform Sitemap
          </Badge>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Explore All FUSIONest Pro Features &amp; Modules
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Quickly navigate across operations, biometric attendance, site DPR engineering, compliance policies, and executive analytics.
          </p>

          {/* Real-time Filter Bar */}
          <div className="pt-4 max-w-md mx-auto">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search modules, tools, or policies..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-11 rounded-2xl glass-card border-primary/20 text-sm focus-visible:ring-primary shadow-sm"
              />
            </div>
          </div>
        </div>

        {/* Section Grid */}
        <div className="space-y-10">
          {filteredSections.map((section, idx) => (
            <motion.div
              key={section.title}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.08 }}
              className="space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-2xl bg-gradient-to-br ${section.color} flex items-center justify-center shadow-sm`}>
                  <section.icon className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                    {section.title}
                  </h2>
                  <p className="text-xs text-muted-foreground">{section.description}</p>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {section.links.map((link) => (
                  <Link
                    key={link.url + link.title}
                    to={link.url}
                    className="group block p-4 rounded-2xl border border-border/40 bg-card/60 hover:bg-card hover:border-primary/40 hover:shadow-md transition-all relative overflow-hidden"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <h3 className="font-semibold text-sm group-hover:text-primary transition-colors flex items-center gap-1.5">
                        {link.title}
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                      </h3>
                      {link.badge && (
                        <Badge variant="outline" className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border-primary/20 shrink-0">
                          {link.badge}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {link.description}
                    </p>
                    <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground pt-2 border-t border-border/30">
                      <span className="font-mono text-[10px] text-foreground/60">{link.url}</span>
                      {link.public ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">Public</span>
                      ) : (
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Lock className="w-2.5 h-2.5" /> Workspace Role
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </motion.div>
          ))}

          {filteredSections.length === 0 && (
            <div className="text-center py-12 space-y-3">
              <p className="text-muted-foreground text-sm">No pages matched &quot;{searchTerm}&quot;</p>
              <Button variant="outline" size="sm" onClick={() => setSearchTerm("")}>
                Clear Search
              </Button>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/40 py-6 text-center text-xs text-muted-foreground bg-card/30">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>&copy; {new Date().getFullYear()} FUSIONest Pro. Enterprise Biometrics &amp; Site DPR.</p>
          <div className="flex items-center gap-4">
            <Link to="/privacy" className="hover:text-primary transition-colors">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-primary transition-colors">Terms of Service</Link>
            <Link to="/" className="hover:text-primary transition-colors">Platform Home</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
