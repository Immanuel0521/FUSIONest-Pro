import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileBarChart, Calendar, IndianRupee, LayoutGrid } from "lucide-react";
import { motion } from "framer-motion";
import DailyReport from "./DailyReport";
import MonthlySalary from "./MonthlySalary";
import FullAttendanceReport from "./FullAttendanceReport";

export default function ReportsHub() {
  const [activeTab, setActiveTab] = useState("full-attendance");

  return (
    <DashboardLayout>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="space-y-6"
      >
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg">
            <FileBarChart className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
              Reports & Payroll
            </h1>
            <p className="text-sm text-muted-foreground">Comprehensive attendance matrix, Sunday/Holiday OT tracking, and monthly salary calculations</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="glass-card p-1 border border-primary/10 h-auto flex-wrap gap-1">
            <TabsTrigger 
              value="full-attendance"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-accent data-[state=active]:text-white transition-all px-5 py-2.5 text-sm font-semibold gap-2"
            >
              <LayoutGrid className="w-4 h-4" />
              Full Attendance Report
            </TabsTrigger>
            <TabsTrigger 
              value="monthly-salary"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-accent data-[state=active]:text-white transition-all px-5 py-2.5 text-sm font-semibold gap-2"
            >
              <IndianRupee className="w-4 h-4" />
              Monthly Salary & OT
            </TabsTrigger>
            <TabsTrigger 
              value="daily" 
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-accent data-[state=active]:text-white transition-all px-5 py-2.5 text-sm font-semibold gap-2"
            >
              <Calendar className="w-4 h-4" />
              Daily Log
            </TabsTrigger>
          </TabsList>

          <TabsContent value="full-attendance" className="mt-6">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <FullAttendanceReport embedded />
            </motion.div>
          </TabsContent>

          <TabsContent value="monthly-salary" className="mt-6">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <MonthlySalary embedded />
            </motion.div>
          </TabsContent>

          <TabsContent value="daily" className="mt-6">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <DailyReport embedded />
            </motion.div>
          </TabsContent>
        </Tabs>
      </motion.div>
    </DashboardLayout>
  );
}
