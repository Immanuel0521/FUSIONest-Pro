import { useState } from "react";
import { motion } from "framer-motion";
import { FolderKanban, Plus, BarChart3, Activity, ClipboardList } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProjectList } from "@/components/projects/ProjectList";
import { ActivityLogForm } from "@/components/projects/ActivityLogForm";
import { ActivityFeed } from "@/components/projects/ActivityFeed";
import { ProgressCharts } from "@/components/projects/ProgressCharts";
import DprHub from "./DprHub";

export default function Projects() {
  const [tab, setTab] = useState("overview");
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <DashboardLayout>
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg">
            <FolderKanban className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Projects</h1>
            <p className="text-sm text-muted-foreground">Manage projects, log daily work, track progress</p>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="glass-card p-1 h-11 flex-wrap">
            <TabsTrigger value="overview" className="gap-2 px-4"><FolderKanban className="w-4 h-4" /> Overview</TabsTrigger>
            <TabsTrigger value="log" className="gap-2 px-4"><Plus className="w-4 h-4" /> Log Activity</TabsTrigger>
            <TabsTrigger value="feed" className="gap-2 px-4"><Activity className="w-4 h-4" /> Activity Feed</TabsTrigger>
            <TabsTrigger value="reports" className="gap-2 px-4"><BarChart3 className="w-4 h-4" /> Reports</TabsTrigger>
            <TabsTrigger value="dpr" className="gap-2 px-4"><ClipboardList className="w-4 h-4" /> Site DPR</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-5">
            <ProjectList />
          </TabsContent>
          <TabsContent value="log" className="mt-5">
            <ActivityLogForm onLogged={() => { setRefreshKey((k) => k + 1); setTab("feed"); }} />
          </TabsContent>
          <TabsContent value="feed" className="mt-5">
            <ActivityFeed refreshKey={refreshKey} />
          </TabsContent>
          <TabsContent value="reports" className="mt-5">
            <ProgressCharts refreshKey={refreshKey} />
          </TabsContent>
          <TabsContent value="dpr" className="mt-5">
            <DprHub embedded />
          </TabsContent>
        </Tabs>
      </motion.div>
    </DashboardLayout>
  );
}
