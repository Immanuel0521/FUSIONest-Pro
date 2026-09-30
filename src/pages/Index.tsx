import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { AuthForm } from "@/components/AuthForm";

const Index = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [loading, setLoading] = useState(true);

  const safeNext = (): string | null => {
    const n = params.get("next");
    if (!n) return null;
    // only allow same-origin relative paths
    if (!n.startsWith("/") || n.startsWith("//")) return null;
    return n;
  };

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (session) {
        const next = safeNext();
        navigate(next ?? "/dashboard", { replace: true });
      } else {
        setLoading(false);
      }
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        const next = safeNext();
        navigate(next ?? "/dashboard", { replace: true });
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, params]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-secondary to-background relative overflow-hidden">
        <div className="absolute inset-0 bg-[var(--gradient-glow)] pointer-events-none" />
        <div className="animate-pulse text-3xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent relative z-10">
          Loading...
        </div>
      </div>
    );
  }

  return <AuthForm />;
};

export default Index;
