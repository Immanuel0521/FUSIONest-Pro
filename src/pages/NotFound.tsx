import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { ArrowLeft, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    if (import.meta.env.DEV) {
      console.warn("404: User attempted to access non-existent route:", location.pathname);
    }
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-foreground p-6">
      <div className="text-center max-w-md space-y-5">
        <div className="w-16 h-16 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto text-primary">
          <Compass className="w-8 h-8" />
        </div>
        <div>
          <h1 className="text-5xl font-black tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            404
          </h1>
          <h2 className="text-xl font-bold mt-2">Page Not Found</h2>
          <p className="text-muted-foreground text-sm mt-1">
            The destination you requested does not exist or may have been relocated.
          </p>
        </div>
        <Button asChild className="gap-2">
          <Link to="/">
            <ArrowLeft className="w-4 h-4" />
            Return to Dashboard
          </Link>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
