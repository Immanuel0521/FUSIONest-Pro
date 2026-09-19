import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { Mail, Lock, LogIn, UserPlus, ArrowRight } from "lucide-react";
import { authFormSchema } from "@/lib/validationSchemas";
import { motion } from "framer-motion";
import heroBg from "@/assets/hero-bg.jpg";
import logo from "@/assets/fusionest-logo.png";

export const AuthForm = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [params] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validationResult = authFormSchema.safeParse({ email, password });
      if (!validationResult.success) {
        const errors = validationResult.error.errors.map(err => err.message).join(", ");
        toast({ title: "Validation Error", description: errors, variant: "destructive" });
        setLoading(false);
        return;
      }

      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast({ title: "Welcome back!", description: "Successfully logged in." });
      } else {
        const nextParam = params.get("next");
        const safeNext = nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "";
        const redirect = `${window.location.origin}/${safeNext ? `?next=${encodeURIComponent(safeNext)}` : ""}`;
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: redirect },
        });
        if (error) throw error;
        toast({ title: "Account created!", description: "You can now log in." });
        setIsLogin(true);
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex flex-col overflow-hidden">
      {/* Full-bleed background image */}
      <img
        src={heroBg}
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
      />
      {/* Overlay gradients */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/50" />
      <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-accent/10" />

      {/* Content */}
      <div className="relative z-10 flex flex-col min-h-screen justify-between p-6 sm:p-8">
        {/* Top section - Logo */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <img src={logo} alt="FUSIONest" className="w-8 h-8 rounded-lg object-contain" />
            <span className="text-white/90 font-semibold tracking-wide text-sm">FUSIONest</span>
          </div>
        </motion.div>

        {/* Middle - Welcome text */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="flex-1 flex flex-col justify-center max-w-lg mx-auto w-full"
        >
          <div className="mb-8">
            <h1 className="sr-only">FUSIONest Pro — Workforce and Project Management</h1>
            <p aria-hidden="true" className="text-5xl sm:text-6xl font-bold text-white tracking-tight leading-[1.1] whitespace-pre-line" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              {isLogin ? "Welcome\nBack" : "Get\nStarted"}
            </p>
            <p className="text-white/60 mt-4 text-base sm:text-lg leading-relaxed">
              {isLogin
                ? "Sign in to manage your workforce, projects and attendance seamlessly."
                : "Create your supervisor account to get started with FUSIONest Pro."}
            </p>
          </div>

          {/* Glass form card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="glass-heavy rounded-3xl p-6 sm:p-8 space-y-5"
          >
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-white/80 text-xs uppercase tracking-wider font-medium flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5" />
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="supervisor@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="bg-white/10 border-white/15 text-white placeholder:text-white/30 rounded-xl h-12 focus:border-primary/60 focus:ring-primary/30"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-white/80 text-xs uppercase tracking-wider font-medium flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5" />
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="bg-white/10 border-white/15 text-white placeholder:text-white/30 rounded-xl h-12 focus:border-primary/60 focus:ring-primary/30"
                />
              </div>

              <Button
                type="submit"
                className="w-full h-12 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-base shadow-lg shadow-primary/25 transition-all"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Processing...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    {isLogin ? "Sign In" : "Sign Up"}
                    <ArrowRight className="w-4 h-4" />
                  </span>
                )}
              </Button>
            </form>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-sm text-white/50 hover:text-white/80 transition-colors"
              >
                {isLogin ? "Don't have an account? " : "Already have an account? "}
                <span className="text-primary font-medium">{isLogin ? "Sign up" : "Sign in"}</span>
              </button>
            </div>
          </motion.div>
        </motion.div>

        {/* Bottom feature pills */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="flex flex-wrap justify-center gap-2 mt-8"
        >
          {["Face Attendance", "Real-time Tracking", "Smart Reports", "Project Management"].map((feature) => (
            <span
              key={feature}
              className="px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-lg border border-white/10 text-white/70 text-xs font-medium"
            >
              {feature}
            </span>
          ))}
        </motion.div>
      </div>
    </div>
  );
};
