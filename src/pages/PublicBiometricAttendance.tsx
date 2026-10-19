import { useState } from "react";
import { FaceScanner } from "@/components/FaceScanner";
import { Scan, ArrowLeft, Copy, Check, QrCode } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useTheme } from "next-themes";
import { useToast } from "@/hooks/use-toast";
import { useCompanyContext } from "@/context/CompanyContext";

export default function PublicBiometricAttendance() {
  const [lastMarkedId, setLastMarkedId] = useState<string | null>(null);
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const { activeCompany } = useCompanyContext();
  const [copied, setCopied] = useState(false);

  const handleAttendanceMarked = (workerId: string, type: 'in' | 'out') => {
    setLastMarkedId(workerId);
  };

  const currentUrl = window.location.href;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(currentUrl);
      setCopied(true);
      toast({ title: 'Link Copied!', description: 'Share this link with workers for direct face attendance' });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ variant: 'destructive', title: 'Failed to copy' });
    }
  };

  return (
    <div className="min-h-screen w-full bg-background relative overflow-hidden">
      {/* Subtle animated background gradient */}
      <div className="fixed inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/5 pointer-events-none" />
      
      {/* Header */}
      <header className="sticky top-0 z-50 w-full glass-card border-b border-border/50 shadow-[0_4px_24px_hsl(var(--primary)/0.08)]">
        <div className="flex h-16 items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-4">
            <Link to="/">
              <Button variant="ghost" size="icon" aria-label="Back to home" className="hover:bg-primary/10">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <h2 className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              {activeCompany?.name ? `${activeCompany.name} Attendance` : "Biometric Attendance"}
            </h2>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyLink}
              className="gap-2"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied!' : 'Share Link'}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Toggle theme"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="hover:bg-primary/10 transition-colors"
            >
              {theme === "dark" ? (
                <Sun className="w-5 h-5" />
              ) : (
                <Moon className="w-5 h-5" />
              )}
            </Button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 max-w-2xl mx-auto p-4 md:p-8 space-y-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg">
            <Scan className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent mb-2">
            Face Attendance
          </h1>
          <p className="text-muted-foreground">
            No login required — scan your face to check in or out
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <FaceScanner onAttendanceMarked={handleAttendanceMarked} publicMode={true} />
        </motion.div>
      </main>
    </div>
  );
}
