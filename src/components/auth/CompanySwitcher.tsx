import { useState } from "react";
import { useCompanyContext } from "@/context/CompanyContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building2, ChevronDown, Check, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";

const ROLE_COLORS: Record<string, string> = {
  admin:      "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  management: "bg-purple-500/15 text-purple-700 dark:text-purple-300",
  supervisor: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  worker:     "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
};

export function CompanySwitcher() {
  const { activeCompany, userRole, memberships, switchCompany } = useCompanyContext();
  const navigate = useNavigate();
  const [switching, setSwitching] = useState(false);

  if (!activeCompany) return null;

  const handleSwitch = async (companyId: string) => {
    if (companyId === activeCompany.id) return;
    setSwitching(true);
    await switchCompany(companyId);
    setSwitching(false);
    // Refresh the page so all data re-fetches for the new company
    window.location.reload();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-2 h-9 px-3 rounded-xl hover:bg-primary/10 max-w-[200px]"
          disabled={switching}
        >
          <Building2 className="w-4 h-4 text-primary shrink-0" />
          <span className="truncate text-sm font-medium">{activeCompany.name}</span>
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-72 glass-heavy rounded-2xl border-border/30 p-2">
        {/* Active company info */}
        <div className="px-3 py-2.5 rounded-xl bg-primary/5 mb-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold truncate">{activeCompany.name}</p>
            {userRole && (
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full capitalize shrink-0 ${ROLE_COLORS[userRole] ?? ""}`}>
                {userRole}
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5 font-mono">{activeCompany.company_code}</p>
        </div>

        {/* Other companies */}
        {memberships.length > 1 && (
          <>
            <DropdownMenuLabel className="text-xs text-muted-foreground px-3 py-1.5">Switch Company</DropdownMenuLabel>
            {memberships
              .filter((m) => m.company_id !== activeCompany.id)
              .map((m) => (
                <DropdownMenuItem
                  key={m.company_id}
                  onClick={() => handleSwitch(m.company_id)}
                  className="rounded-xl cursor-pointer gap-2 px-3"
                >
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{m.company.name}</p>
                    <p className="text-[10px] text-muted-foreground capitalize">{m.role}</p>
                  </div>
                </DropdownMenuItem>
              ))}
            <DropdownMenuSeparator className="bg-border/30" />
          </>
        )}

        {/* Join another company */}
        <DropdownMenuItem
          onClick={() => navigate("/onboarding")}
          className="rounded-xl cursor-pointer gap-2 px-3 text-primary"
        >
          <Plus className="w-4 h-4" />
          <span className="text-sm">Add / Join Another Company</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
