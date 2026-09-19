import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { ClipboardList, Plus, Truck, Boxes, CalendarRange, BookMarked, History } from "lucide-react";
import { format } from "date-fns";
import { Link, useNavigate } from "react-router-dom";
import { DPR_STAGES } from "@/pages/DprWizard";
import { MaterialReferencePanel } from "@/components/projects/MaterialReferencePanel";
import { SiteStockPanel } from "@/components/projects/SiteStockPanel";
import { DispatchPanel } from "@/components/projects/DispatchPanel";
import { LookAheadPanel } from "@/components/projects/LookAheadPanel";
import { useUserRole } from "@/hooks/useUserRole";

export function DprPanel({ projectId }: { projectId: string }) {
  const { toast } = useToast();
  const nav = useNavigate();
  const [reports, setReports] = useState<any[]>([]);
  const [creating, setCreating] = useState(false);
  const [subtab, setSubtab] = useState("dpr");
  const { role } = useUserRole();
  const [canManage, setCanManage] = useState(false);

  // history filters
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const load = async () => {
    const { data } = await supabase.from("dpr_reports" as any).select("*").eq("project_id", projectId).order("report_date", { ascending: false });
    setReports((data as any[]) || []);
  };

  useEffect(() => { load(); }, [projectId]);

  useEffect(() => { (async () => {
    const { data: u } = await supabase.auth.getUser();
    const uid = u.user?.id;
    if (role === "admin" || role === "management") { setCanManage(true); return; }
    const { data: p } = await supabase.from("projects").select("supervisor_id, project_manager_id").eq("id", projectId).maybeSingle();
    setCanManage(!!uid && (p?.supervisor_id === uid || (p as any)?.project_manager_id === uid));
  })(); }, [projectId, role]);

  const startToday = async () => {
    setCreating(true);
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    const today = new Date().toISOString().split("T")[0];
    const existing = reports.find((r) => r.report_date === today);
    if (existing) { nav(`/projects/${projectId}/dpr/${existing.id}`); setCreating(false); return; }
    const { data: numData } = await supabase.rpc("next_dpr_number" as any, { _project_id: projectId });
    const { data: inserted, error } = await supabase.from("dpr_reports" as any).insert({
      project_id: projectId,
      dpr_number: numData as any,
      report_date: today,
      site_engineer_id: uid,
      status: "draft",
    } as any).select().single();
    if (error) toast({ variant: "destructive", title: "Failed", description: error.message });
    else { toast({ title: "DPR draft created", description: numData as any }); nav(`/projects/${projectId}/dpr/${(inserted as any).id}`); }
    setCreating(false);
  };

  const today = new Date().toISOString().split("T")[0];
  const todayReport = reports.find((r) => r.report_date === today);

  const filtered = useMemo(() => reports.filter((r) => {
    if (fromDate && r.report_date < fromDate) return false;
    if (toDate && r.report_date > toDate) return false;
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    return true;
  }), [reports, fromDate, toDate, statusFilter]);

  return (
    <Tabs value={subtab} onValueChange={setSubtab} className="space-y-4">
      <TabsList className="glass-card p-1 h-11 flex-wrap">
        <TabsTrigger value="dpr" className="gap-2 px-3"><ClipboardList className="w-4 h-4" /> DPR</TabsTrigger>
        <TabsTrigger value="dispatch" className="gap-2 px-3"><Truck className="w-4 h-4" /> Dispatch</TabsTrigger>
        <TabsTrigger value="stock" className="gap-2 px-3"><Boxes className="w-4 h-4" /> Site Stock</TabsTrigger>
        <TabsTrigger value="lookahead" className="gap-2 px-3"><CalendarRange className="w-4 h-4" /> 4-Day Look-Ahead</TabsTrigger>
        <TabsTrigger value="reference" className="gap-2 px-3"><BookMarked className="w-4 h-4" /> Materials List</TabsTrigger>
        <TabsTrigger value="history" className="gap-2 px-3"><History className="w-4 h-4" /> History</TabsTrigger>
      </TabsList>

      <TabsContent value="dpr" className="space-y-4">
        <Card className="glass-card rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold flex items-center gap-2"><ClipboardList className="w-5 h-5 text-primary" /> Today's DPR</h3>
            {!todayReport && <Button size="sm" onClick={startToday} disabled={creating} className="gap-2"><Plus className="w-4 h-4" /> Start DPR</Button>}
          </div>
          {todayReport ? (
            <Link to={`/projects/${projectId}/dpr/${todayReport.id}`} className="block p-3 rounded-xl glass flex items-center justify-between hover:shadow-md transition-all">
              <div>
                <div className="font-semibold">{todayReport.dpr_number}</div>
                <div className="text-xs text-muted-foreground">{format(new Date(todayReport.report_date), "PPP")}</div>
              </div>
              <Badge variant="outline" className="text-[10px]">{todayReport.status}</Badge>
            </Link>
          ) : (
            <p className="text-sm text-muted-foreground">No DPR started for today. Tap Start DPR to begin.</p>
          )}
        </Card>

        <Card className="glass-card rounded-2xl p-5">
          <h3 className="font-bold mb-3 text-sm">Recent DPRs</h3>
          {reports.length === 0 ? <p className="text-sm text-muted-foreground">No DPRs yet.</p> :
            <div className="space-y-2">
              {reports.slice(0, 5).map((r) => (
                <Link key={r.id} to={r.status === "submitted" || r.status === "under_review" ? `/dpr/${r.id}/review` : `/projects/${projectId}/dpr/${r.id}`}
                  className="block p-3 rounded-xl glass flex items-center justify-between hover:shadow-md transition-all">
                  <div>
                    <div className="font-semibold text-sm">{r.dpr_number}</div>
                    <div className="text-xs text-muted-foreground">{format(new Date(r.report_date), "PPP")}</div>
                  </div>
                  <Badge variant="outline" className="text-[10px]">{r.status}</Badge>
                </Link>
              ))}
            </div>}
        </Card>
      </TabsContent>

      <TabsContent value="dispatch">
        <DispatchPanel projectId={projectId} canManage={canManage} />
      </TabsContent>
      <TabsContent value="stock">
        <SiteStockPanel projectId={projectId} canManage={canManage} />
      </TabsContent>
      <TabsContent value="lookahead">
        <LookAheadPanel projectId={projectId} canManage={canManage} />
      </TabsContent>
      <TabsContent value="reference">
        <MaterialReferencePanel projectId={projectId} canManage={canManage} />
      </TabsContent>

      <TabsContent value="history" className="space-y-4">
        <Card className="glass-card rounded-2xl p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <div>
              <label className="text-xs text-muted-foreground">From</label>
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">To</label>
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="submitted">Submitted</SelectItem>
                  <SelectItem value="under_review">Under review</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="returned">Returned</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button variant="outline" size="sm" onClick={() => { setFromDate(""); setToDate(""); setStatusFilter("all"); }}>Clear filters</Button>
            </div>
          </div>
        </Card>

        <Card className="glass-card rounded-2xl p-5">
          {filtered.length === 0 ? <p className="text-sm text-muted-foreground">No DPRs match these filters.</p> :
            <div className="space-y-2">
              {filtered.map((r) => (
                <Link key={r.id} to={r.status === "submitted" || r.status === "under_review" ? `/dpr/${r.id}/review` : `/projects/${projectId}/dpr/${r.id}`}
                  className="block p-3 rounded-xl glass flex items-center justify-between hover:shadow-md transition-all">
                  <div className="min-w-0">
                    <div className="font-semibold text-sm truncate">{r.dpr_number}</div>
                    <div className="text-xs text-muted-foreground">{format(new Date(r.report_date), "PPP")} · {format(new Date(r.report_date), "EEEE")}</div>
                  </div>
                  <Badge variant="outline" className="text-[10px] capitalize">{(r.status || "").replace("_", " ")}</Badge>
                </Link>
              ))}
            </div>}
          <div className="mt-3 text-[10px] text-muted-foreground">
            Stage filter and target-achieved filter will populate once activities are logged with stage metadata.
          </div>
        </Card>
      </TabsContent>
    </Tabs>
  );
}