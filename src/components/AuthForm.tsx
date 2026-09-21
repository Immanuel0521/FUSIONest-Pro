import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { Mail, Lock, ArrowRight, Loader2, User } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import heroBg from "@/assets/hero-bg.jpg";
import logo from "@/assets/fusionest-logo.png";

export const AuthForm = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [params] = useSearchParams();
  const { toast } = useToast();

  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading]   = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast({ title: "Welcome back!", description: "Successfully signed in." });
      } else {
        if (!fullName.trim()) {
          toast({ title: "Name required", description: "Please enter your full name.", variant: "destructive" });
          setLoading(false);
          return;
        }
        const nextParam = params.get("next");
        const safeNext  = nextParam?.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "";
        const redirect  = `${window.location.origin}/${safeNext ? `?next=${encodeURIComponent(safeNext)}` : ""}`;
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: redirect,
            data: { full_name: fullName.trim() },
          },
        });
        if (error) throw error;
        toast({ title: "Account created!", description: "Check your email to confirm, then sign in." });
        setIsLogin(true);
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex flex-col overflow-hidden">
      {/* Background */}
      <img src={heroBg} alt="" className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/50" />
      <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-accent/10" />

      <div className="relative z-10 flex flex-col min-h-screen justify-between p-6 sm:p-8">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex items-center gap-3"
        >
          <img src={logo} alt="FUSIONest" className="w-8 h-8 rounded-lg object-contain" />
          <span className="text-white/90 font-semibold tracking-wide text-sm">FUSIONest Pro</span>
        </motion.div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full"
        >
          <div className="mb-8">
            <p
              className="text-5xl sm:text-6xl font-bold text-white tracking-tight leading-[1.1] whitespace-pre-line"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              {isLogin ? "Welcome\nBack" : "Get\nStarted"}
            </p>
            <p className="text-white/60 mt-4 text-base leading-relaxed">
              {isLogin
                ? "Sign in to manage your workforce, projects and attendance seamlessly."
                : "Create your account and set up your company workspace."}
            </p>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="glass-heavy rounded-3xl p-6 sm:p-8 space-y-5"
          >
            <AnimatePresence mode="wait">
              <motion.form
                key={isLogin ? "login" : "signup"}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                onSubmit={handleSubmit}
                className="space-y-4"
              >
                {/* Full name – signup only */}
                {!isLogin && (
                  <div className="space-y-2">
                    <Label
                      htmlFor="fullName"
                      className="text-white/80 text-xs uppercase tracking-wider font-medium flex items-center gap-2"
                    >
                      <User className="w-3.5 h-3.5" /> Full Name
                    </Label>
                    <Input
                      id="fullName"
                      placeholder="e.g. Rajan Sharma"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="bg-white/10 border-white/15 text-white placeholder:text-white/30 rounded-xl h-12 focus:border-primary/60 focus:ring-primary/30"
                    />
                  </div>
                )}

                {/* Email */}
                <div className="space-y-2">
                  <Label
                    htmlFor="email"
                    className="text-white/80 text-xs uppercase tracking-wider font-medium flex items-center gap-2"
                  >
                    <Mail className="w-3.5 h-3.5" /> Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="bg-white/10 border-white/15 text-white placeholder:text-white/30 rounded-xl h-12 focus:border-primary/60 focus:ring-primary/30"
                  />
                </div>

                {/* Password */}
                <div className="space-y-2">
                  <Label
                    htmlFor="password"
                    className="text-white/80 text-xs uppercase tracking-wider font-medium flex items-center gap-2"
                  >
                    <Lock className="w-3.5 h-3.5" /> Password
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
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <span className="flex items-center gap-2">
                      {isLogin ? "Sign In" : "Create Account"}
                      <ArrowRight className="w-4 h-4" />
                    </span>
                  )}
                </Button>
              </motion.form>
            </AnimatePresence>

            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => { setIsLogin(!isLogin); setFullName(""); }}
                className="text-sm text-white/50 hover:text-white/80 transition-colors"
              >
                {isLogin ? "No account yet? " : "Already have an account? "}
                <span className="text-primary font-medium">
                  {isLogin ? "Sign up" : "Sign in"}
                </span>
              </button>
            </div>
          </motion.div>
        </motion.div>

        {/* Feature pills */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="flex flex-wrap justify-center gap-2 mt-8"
        >
          {["Face Attendance", "Real-time Tracking", "Smart Reports", "Multi-Company"].map((f) => (
            <span
              key={f}
              className="px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-lg border border-white/10 text-white/70 text-xs font-medium"
            >
              {f}
            </span>
          ))}
        </motion.div>
      </div>
    </div>
  );
};
