import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen, ClipboardCheck, ListChecks, Plus, Sparkles, ShieldCheck,
  CheckCircle2, ArrowRight, FileText
} from "lucide-react";
import Methodologies from "./Methodologies";
import Checklists from "./Checklists";

export default function StageQualityStandards() {
  const [params, setParams] = useSearchParams();
  const defaultTab = params.get("tab") || "methodologies";
  const [tab, setTab] = useState(defaultTab);
  const navigate = useNavigate();

  const handleTabChange = (val: string) => {
    setTab(val);
    setParams({ tab: val });
  };

  return (
    <DashboardLayout>
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        {/* Header Banner */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                Execution Standards & Quality
              </h1>
              <p className="text-sm text-muted-foreground">
                Engineers must review <strong>Methodologies (SOPs)</strong> before starting each stage, and sign off <strong>Checklists</strong> before completion.
              </p>
            </div>
          </div>
        </div>

        {/* Tab switch */}
        <Tabs value={tab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="glass-card p-1 h-12 flex-wrap">
            <TabsTrigger
              value="methodologies"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-accent data-[state=active]:text-white transition-all px-5 py-2 text-sm font-semibold gap-2"
            >
              <BookOpen className="w-4 h-4" />
              1. Stage Methodologies (Before Starting)
            </TabsTrigger>
            <TabsTrigger
              value="checklists"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-accent data-[state=active]:text-white transition-all px-5 py-2 text-sm font-semibold gap-2"
            >
              <ClipboardCheck className="w-4 h-4" />
              2. Stage Quality Checklists (Before Completing)
            </TabsTrigger>
          </TabsList>

          <TabsContent value="methodologies" className="mt-6">
            <Methodologies embedded />
          </TabsContent>

          <TabsContent value="checklists" className="mt-6">
            <Checklists embedded />
          </TabsContent>
        </Tabs>
      </motion.div>
    </DashboardLayout>
  );
}
