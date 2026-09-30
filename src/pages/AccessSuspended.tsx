import { useCompanyContext } from "@/context/CompanyContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldX, Mail, RefreshCw, Building2 } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase";

export default function AccessSuspended() {
  const { activeCompany, memberships, switchCompany } = useCompanyContext();

  // Other companies the user belongs to that are still active
  const otherActive = memberships.filter(
    m => m.company_id !== activeCompany?.id && (m.company as any).is_active !== false
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-destructive/5 to-background p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-md"
      >
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 rounded-3xl bg-destructive/10 border-2 border-destructive/20 flex items-center justify-center">
            <ShieldX className="w-10 h-10 text-destructive" />
          </div>
        </div>

        {/* Message */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold mb-2">Access Suspended</h1>
          <p className="text-muted-foreground text-sm">
            <span className="font-medium text-foreground">{activeCompany?.name || "Your company"}</span>'s
            access to FUSIONest Pro has been suspended.
          </p>
          {(activeCompany as any)?.suspended_reason && (
            <p className="mt-3 text-sm text-destructive/80 bg-destructive/10 rounded-2xl px-4 py-3">
              Reason: {(activeCompany as any).suspended_reason}
            </p>
          )}
        </div>

        {/* Contact card */}
        <Card className="rounded-3xl border-border/30 glass-heavy mb-4">
          <CardContent className="pt-6 text-center space-y-3">
            <p className="font-semibold text-sm">Contact FUSIONest Support</p>
            <a
              href="mailto:immanuel9959@gmail.com"
              className="flex items-center justify-center gap-2 text-primary hover:underline text-sm font-medium"
            >
              <Mail className="w-4 h-4" />
              immanuel9959@gmail.com
            </a>
            <p className="text-xs text-muted-foreground">
              Reply within 24 hours • Mon–Sat, 9 AM – 6 PM IST
            </p>
          </CardContent>
        </Card>

        {/* Switch company if they have other active ones */}
        {otherActive.length > 0 && (
          <Card className="rounded-3xl border-border/30 glass-heavy mb-4">
            <CardContent className="pt-6 space-y-2">
              <p className="text-sm font-semibold mb-3">Switch to another company</p>
              {otherActive.map(m => (
                <Button
                  key={m.company_id}
                  variant="outline"
                  className="w-full rounded-2xl gap-2 justify-start"
                  onClick={() => switchCompany(m.company_id)}
                >
                  <Building2 className="w-4 h-4 text-primary" />
                  {m.company.name}
                </Button>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Logout */}
        <Button
          variant="ghost"
          className="w-full rounded-2xl gap-2 text-muted-foreground"
          onClick={() => supabase.auth.signOut().then(() => window.location.href = "/")}
        >
          Sign out and try a different account
        </Button>
      </motion.div>
    </div>
  );
}
