import { NavLink } from "react-router-dom";
import { LayoutDashboard, Users, FolderKanban, FileBarChart, Shield } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";

const navItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, roles: ["admin", "management", "supervisor"] },
  { title: "Workforce", url: "/workforce", icon: Users, roles: ["admin", "management", "supervisor"] },
  { title: "Projects", url: "/projects", icon: FolderKanban, roles: ["admin", "management", "supervisor"] },
  { title: "Reports", url: "/reports", icon: FileBarChart, roles: ["admin", "management"] },
  { title: "Admin", url: "/admin", icon: Shield, roles: ["admin"] },
];

export const BottomNav = () => {
  const { role } = useUserRole();

  const filteredItems = navItems.filter(item => role && item.roles.includes(role));

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 lg:hidden">
      <div className="mx-3 mb-3">
        <nav className="glass-heavy rounded-2xl px-2 py-2 flex items-center justify-around gap-1">
          {filteredItems.map((item) => (
            <NavLink
              key={item.url}
              to={item.url}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all text-[10px] font-medium min-w-[56px] ${
                  isActive
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              <span>{item.title}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
};
