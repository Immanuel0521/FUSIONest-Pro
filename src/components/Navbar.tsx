import { Moon, Sun, User, LogOut, Menu, LayoutDashboard, Users, FolderKanban, FileBarChart, Shield, History, MapPin, BookOpen, ClipboardCheck, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NavLink, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { NotificationBell } from "@/components/NotificationBell";
import { useUserRole } from "@/hooks/useUserRole";
import logo from "@/assets/fusionest-logo.png";
import { CompanySwitcher } from "@/components/auth/CompanySwitcher";


const allNavItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, roles: ["admin", "management", "supervisor"] },
  { title: "Workforce", url: "/workforce", icon: Users, roles: ["admin", "management", "supervisor"] },
  { title: "Projects", url: "/projects", icon: FolderKanban, roles: ["admin", "management", "supervisor"] },
  { title: "Methodologies", url: "/methodologies", icon: BookOpen, roles: ["admin", "management", "supervisor"] },
  { title: "Checklists", url: "/checklists", icon: ClipboardCheck, roles: ["admin", "management", "supervisor"] },
  { title: "Site DPR", url: "/dpr", icon: ClipboardList, roles: ["admin", "management", "supervisor"] },
  { title: "Reports", url: "/reports", icon: FileBarChart, roles: ["admin", "management"] },
  { title: "Attendance History", url: "/attendance-history", icon: History, roles: ["admin", "management"] },
  { title: "Work Allocation", url: "/work-allocation-history", icon: MapPin, roles: ["admin"] },
  { title: "Admin", url: "/admin", icon: Shield, roles: ["admin"] },
];

export const Navbar = () => {
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { role } = useUserRole();
  const [userProfile, setUserProfile] = useState<{ full_name: string; photo_url: string | null } | null>(null);

  const navItems = allNavItems.filter(item => role && item.roles.includes(role));

  useEffect(() => {
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from('user_profiles').select('full_name, photo_url').eq('id', user.id).maybeSingle();
      if (data) setUserProfile(data);
    }
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } else {
      navigate("/");
    }
  };

  const [mobileOpen, setMobileOpen] = useState(false);

  const getRoleLabel = () => {
    if (role === "admin") return "Admin";
    if (role === "management") return "Management";
    if (role === "supervisor") return "Supervisor";
    if (role === "viewer") return "Viewer";
    return "User";
  };

  return (
    <header className="sticky top-0 z-50 w-full glass-heavy border-b border-border/30">
      <div className="flex h-14 items-center justify-between px-4 lg:px-6">
        <div className="flex items-center gap-3">
          {/* Mobile menu */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open navigation menu" className="lg:hidden hover:bg-primary/10 w-9 h-9">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 glass-heavy border-r-0">
              <div className="flex items-center gap-3 mb-8 mt-2">
                <img src={logo} alt="FUSIONest" className="w-8 h-8 rounded-lg object-contain" />
                <span className="font-bold text-lg" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>FUSIONest Pro</span>
              </div>
              <nav className="flex flex-col gap-1">
                {navItems.map((item) => (
                  <NavLink
                    key={item.url}
                    to={item.url}
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm ${
                        isActive
                          ? "bg-primary/12 text-primary font-semibold"
                          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                      }`
                    }
                  >
                    <item.icon className="w-5 h-5" />
                    <span>{item.title}</span>
                  </NavLink>
                ))}
              </nav>
            </SheetContent>
          </Sheet>

          <div className="flex items-center gap-2.5">
            <img src={logo} alt="FUSIONest" className="w-7 h-7 rounded-lg object-contain hidden sm:block" />
            <h2 className="text-lg font-bold tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              <span className="text-primary">FUSION</span>
              <span className="text-foreground">est</span>
            </h2>
          </div>

          {/* Company switcher */}
          <div className="hidden sm:block">
            <CompanySwitcher />
          </div>
        </div>


        {/* Desktop navigation */}
        <nav className="hidden lg:flex items-center gap-0.5">
          {navItems.map((item) => (
            <NavLink
              key={item.url}
              to={item.url}
              className={({ isActive }) =>
                `flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? "bg-primary/12 text-primary"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                }`
              }
            >
              <item.icon className="w-4 h-4" />
              <span>{item.title}</span>
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-1.5">
          <NotificationBell />
          <Button
            variant="ghost"
            size="icon"
            aria-label="Toggle theme"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="hover:bg-primary/10 w-9 h-9 rounded-xl"
          >
            {theme === "dark" ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4.5 h-4.5" />}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Avatar className="w-9 h-9 border-2 border-primary/20 cursor-pointer hover:border-primary/50 transition-all ring-2 ring-background">
                <AvatarImage src={userProfile?.photo_url || undefined} />
                <AvatarFallback className="bg-primary/15 text-primary text-xs font-bold">
                  {userProfile?.full_name?.split(' ').map(n => n[0]).join('').substring(0, 2) || 'U'}
                </AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 glass-heavy rounded-2xl border-border/30 p-2">
              <div className="px-3 py-2">
                <p className="text-sm font-semibold">{userProfile?.full_name || 'User'}</p>
                <p className="text-xs text-muted-foreground">{getRoleLabel()}</p>
              </div>
              <DropdownMenuSeparator className="bg-border/30" />
              <DropdownMenuItem onClick={() => navigate('/profile')} className="cursor-pointer rounded-xl">
                <User className="w-4 h-4 mr-2" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-border/30" />
              <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive focus:text-destructive rounded-xl">
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};
