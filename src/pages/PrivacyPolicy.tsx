import { Link } from "react-router-dom";
import { ArrowLeft, Shield, Lock, Eye, FileText, Database, Server } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function PrivacyPolicy() {
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
            <Shield className="w-3.5 h-3.5" /> Compliance &amp; Data Protection
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Privacy Policy &amp; Data Protection Notice
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            FUSIONest Pro (&quot;we&quot;, &quot;our&quot;, &quot;us&quot;) provides workforce attendance, biometric verification, 
            site progress reporting, and project quality control solutions for construction and manufacturing teams. 
            This Privacy Policy explains how we collect, process, store, and safeguard your data in compliance with 
            the <strong>Digital Personal Data Protection Act, 2023 (DPDP Act, India)</strong> and global privacy standards.
          </p>
        </div>

        {/* Key Highlights */}
        <div className="grid sm:grid-cols-3 gap-4">
          <Card className="glass-card">
            <CardContent className="pt-5 space-y-2">
              <Lock className="w-5 h-5 text-primary" />
              <h2 className="font-semibold text-sm">Encrypted Storage</h2>
              <p className="text-xs text-muted-foreground">All databases and asset storage use AES-256 encryption at rest and TLS 1.3 in transit.</p>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="pt-5 space-y-2">
              <Eye className="w-5 h-5 text-primary" />
              <h2 className="font-semibold text-sm">Biometric Protection</h2>
              <p className="text-xs text-muted-foreground">Face recognition embeddings are processed strictly for on-site muster rolls and are never sold.</p>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="pt-5 space-y-2">
              <Database className="w-5 h-5 text-primary" />
              <h2 className="font-semibold text-sm">Strict Tenant Isolation</h2>
              <p className="text-xs text-muted-foreground">Row-Level Security (RLS) ensures organizational data remains strictly isolated to your company.</p>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Sections */}
        <div className="space-y-6 text-sm text-foreground/90 leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-lg font-bold text-foreground">1. Personal &amp; Workforce Data We Collect</h2>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li><strong>Account Credentials:</strong> Full name, professional email address, phone number, and password hashes for authentication.</li>
              <li><strong>Workforce Profiles:</strong> Worker names, assigned designations, site affiliations, photos, and emergency contact details.</li>
              <li><strong>Biometric Data &amp; Verification Snapshots:</strong>
                <ul className="list-[circle] pl-5 mt-1 space-y-1">
                  <li><strong>Facial Landmark Vectors:</strong> Mathematical 128-dimensional vector descriptors extracted locally within the browser session via client-side WebAssembly models without streaming continuous video to external servers.</li>
                  <li><strong>Attendance Verification Photos:</strong> Static photographic snapshots captured at the exact moment of check-in and check-out to verify physical worker presence and prevent buddy punching.</li>
                </ul>
              </li>
              <li><strong>Attendance &amp; Operational Logs:</strong> Time-in, time-out timestamps, overtime records, site geolocation coordinates (captured only during check-in/out for geo-fencing verification), and site supervisor sign-offs.</li>
              <li><strong>Project Documentation:</strong> Daily Progress Reports (DPR), quality checklists, material alerts, and stage methodologies.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-foreground">2. Purpose of Data Processing</h2>
            <p className="text-muted-foreground">We process workforce and operational data strictly for legitimate operational purposes:</p>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li>Verifying worker presence and authenticating identity on physical construction job sites.</li>
              <li>Calculating accurate payroll, overtime hours (including Sunday/Holiday OT), and generating muster roll reports.</li>
              <li>Enforcing construction quality compliance through stage methodologies and engineering checklists.</li>
              <li>Ensuring multi-tenant administrative segregation and access control.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-foreground">3. Biometric Data Handling, Storage &amp; Access Controls</h2>
            <p className="text-muted-foreground">
              In accordance with applicable data protection principles:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li><strong>Local Processing:</strong> Face landmark extraction runs in the client browser using WebAssembly. Real-time video streams are not transmitted or stored on cloud servers.</li>
              <li><strong>Encrypted Storage:</strong> Vector embeddings are stored in protected database tables. Attendance verification snapshot photos are stored in a private, non-public storage bucket (<code>attendance-photos</code>) protected by Row Level Security and authentication guards.</li>
              <li><strong>Access Control:</strong> Verification snapshots are accessible strictly to authorized company supervisors and management for attendance verification and muster audit. Snapshots are never publicly accessible, shared with third parties, or commercialized.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-foreground">4. Data Retention, Cleanup Practices &amp; Deletion</h2>
            <p className="text-muted-foreground">
              Attendance records and project archives are retained for the duration of the subscribing company&apos;s active account or as required by statutory labor legislation:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li><strong>Attendance Photo Cleanup Function:</strong> A server-side cleanup Edge Function (<code>cleanup-attendance-photos</code>) is deployed to purge approved attendance photos older than 24 hours from cloud storage and database tables.</li>
              <li><strong>Scheduled Execution Notice:</strong> Automated periodic execution of this cleanup function requires platform cron scheduling (e.g., <code>pg_cron</code>) to be enabled by the database administrator. Where scheduled automation is not active, records persist until manually triggered or pruned by authorized personnel.</li>
              <li><strong>Account Termination:</strong> Upon termination of service or upon verified data erasure request, company data is archived or deleted in accordance with contractual agreements and legal retention mandates.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-foreground">5. Statutory Consent &amp; Employer Responsibilities (DPDP Act, 2023)</h2>
            <p className="text-muted-foreground">
              Under the Digital Personal Data Protection Act, 2023 (DPDP Act, India), employers and contractor organizations act as Data Fiduciaries:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li><strong>Employer Consent Obligation:</strong> Organizations using FUSIONest Pro are responsible for obtaining prior, explicit, and informed consent from workers before enrolling their facial biometric embeddings or capturing on-duty attendance photos.</li>
              <li><strong>Notice:</strong> Workers must be informed of the purpose, retention period, and security safeguards applied to their biometric descriptors and attendance logs.</li>
              <li><strong>Right to Correction &amp; Erasure:</strong> Workers retain statutory rights to request correction of inaccurate records and erasure of personal data upon cessation of employment, subject to applicable statutory labor records obligations.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-foreground">6. Data Fiduciary &amp; Grievance Officer Contact</h2>
            <p className="text-muted-foreground">
              If you have any questions, compliance requests, or wish to exercise your rights under data protection laws, 
              please contact our Grievance Redressal Officer at:
            </p>
            <div className="p-4 rounded-xl border bg-muted/30 text-xs space-y-1">
              <p><strong>FUSIONest Pro — Data Privacy &amp; Governance</strong></p>
              <p>Email: <a href="mailto:privacy@fusionest.com" className="text-primary hover:underline">privacy@fusionest.com</a> / <a href="mailto:immanuel9959@gmail.com" className="text-primary hover:underline">immanuel9959@gmail.com</a></p>
              <p>Jurisdiction: Republic of India</p>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="pt-6 border-t flex items-center justify-between text-xs text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} FUSIONest Pro. All rights reserved.</p>
          <div className="flex gap-4">
            <Link to="/terms" className="hover:text-primary transition-colors">Terms of Service</Link>
            <Link to="/" className="hover:text-primary transition-colors">Login</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
