import { Link } from "react-router-dom";
import { ArrowLeft, FileCheck, ShieldCheck, Scale, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-background text-foreground py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" asChild className="gap-2">
            <Link to="/">
              <ArrowLeft className="w-4 h-4" /> Back to Application
            </Link>
          </Button>
          <span className="text-xs text-muted-foreground font-mono">Last updated: October 2026</span>
        </div>

        {/* Header */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
            <Scale className="w-3.5 h-3.5" /> Legal Agreement
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Terms &amp; Conditions of Service
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            These Terms of Service (&quot;Terms&quot;) govern access to and usage of the FUSIONest Pro SaaS platform, 
            biometric attendance kiosks, project DPR tracking, and construction quality management systems.
          </p>
        </div>

        {/* Detailed Sections */}
        <div className="space-y-6 text-sm text-foreground/90 leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-lg font-bold text-foreground">1. Acceptance of Terms</h2>
            <p className="text-muted-foreground">
              By creating an account, registering a company, accessing the attendance scanning kiosks, or submitting 
              site reports through FUSIONest Pro, you agree to be bound by these Terms and our Privacy Policy. If you are 
              acting on behalf of an entity, you confirm that you possess the necessary authority to bind that entity.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-foreground">2. User Roles &amp; Organizational Obligations</h2>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li><strong>Company Administrators:</strong> Responsible for maintaining accurate employee rosters, managing role permissions, reviewing overtime records, and maintaining confidentiality of company join codes.</li>
              <li><strong>Supervisors &amp; Engineers:</strong> Authorized to record muster rolls, sign off stage quality checklists, submit daily progress logs (DPR), and document site safety incidents truthfully.</li>
              <li><strong>Workers:</strong> Entitled to accurate recording of working hours and overtime. Proxy attendance or spoofing biometric capture is strictly prohibited and subject to administrative disciplinary review.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-foreground">3. Biometric Verification &amp; Consent Representation</h2>
            <p className="text-muted-foreground">
              Companies utilizing FUSIONest Pro biometric facial attendance represent and warrant that they have 
              informed workers and obtained requisite operational consent for identity verification on job sites in 
              accordance with applicable labor laws and statutory regulations.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-foreground">4. System Availability &amp; Offline Functionality</h2>
            <p className="text-muted-foreground">
              FUSIONest Pro is engineered with offline-resilient local caches for remote construction sites. While we strive 
              for 99.9% uptime, we are not liable for delays resulting from field hardware malfunction, extreme weather disruptions, 
              or third-party network outages. Data synchronizes automatically once network connectivity is re-established.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-foreground">5. Intellectual Property &amp; Data Ownership</h2>
            <p className="text-muted-foreground">
              All proprietary logos, software architecture, algorithm pipelines, and branding are the intellectual property 
              of FUSIONest. Customers retain complete ownership of all project data, DPR logs, worker profiles, and site 
              photographs stored within their organization&apos;s isolated tenant space.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-foreground">6. Limitation of Liability &amp; Governing Law</h2>
            <p className="text-muted-foreground">
              To the maximum extent permitted by law, FUSIONest Pro shall not be liable for indirect, punitive, or consequential 
              damages. These Terms are governed by and construed in accordance with the laws of the Republic of India, and any 
              disputes shall be subject to the exclusive jurisdiction of the competent courts of India.
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="pt-6 border-t flex items-center justify-between text-xs text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} FUSIONest Pro. All rights reserved.</p>
          <div className="flex gap-4">
            <Link to="/privacy" className="hover:text-primary transition-colors">Privacy Policy</Link>
            <Link to="/" className="hover:text-primary transition-colors">Login</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
