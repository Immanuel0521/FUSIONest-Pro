import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileBarChart, Calendar, BarChart3, Users, IndianRupee, LayoutGrid } from "lucide-react";
import { motion } from "framer-motion";
import DailyReport from "./DailyReport";
import MonthlyAttendance from "./MonthlyAttendance";
import MonthlySalary from "./MonthlySalary";
import Analytics from "./Analytics";
import FullAttendanceReport from "./FullAttendanceReport";

export default function ReportsHub() {
  const [activeTab, setActiveTab] = useState("daily");

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
              Reports & Analytics
            </h1>
            <p className="text-sm text-muted-foreground">View attendance reports, salary calculations, and activity analytics</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="glass-card p-1 border border-primary/10 h-auto flex-wrap gap-1">
            <TabsTrigger 
              value="daily" 
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-accent data-[state=active]:text-white transition-all px-4 py-2 text-sm font-medium gap-2"
            >
              <Calendar className="w-4 h-4" />
              Daily
            </TabsTrigger>
            <TabsTrigger 
              value="monthly-attendance"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-accent data-[state=active]:text-white transition-all px-4 py-2 text-sm font-medium gap-2"
            >
              <Users className="w-4 h-4" />
              Monthly Attendance
            </TabsTrigger>
            <TabsTrigger 
              value="monthly-salary"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-accent data-[state=active]:text-white transition-all px-4 py-2 text-sm font-medium gap-2"
            >
              <IndianRupee className="w-4 h-4" />
              Monthly Salary
            </TabsTrigger>
            <TabsTrigger 
              value="analytics"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-accent data-[state=active]:text-white transition-all px-4 py-2 text-sm font-medium gap-2"
            >
              <BarChart3 className="w-4 h-4" />
              Analytics
            </TabsTrigger>
            <TabsTrigger 
              value="full-attendance"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-accent data-[state=active]:text-white transition-all px-4 py-2 text-sm font-medium gap-2"
            >
              <LayoutGrid className="w-4 h-4" />
              Full Attendance Report
            </TabsTrigger>
          </TabsList>

          <TabsContent value="daily" className="mt-6">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
            >
              <DailyReport embedded />
            </motion.div>
          </TabsContent>

          <TabsContent value="monthly-attendance" className="mt-6">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
            >
              <MonthlyAttendance embedded />
            </motion.div>
          </TabsContent>

          <TabsContent value="monthly-salary" className="mt-6">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
            >
              <MonthlySalary embedded />
            </motion.div>
          </TabsContent>

          <TabsContent value="analytics" className="mt-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Analytics embedded />
            </motion.div>
          </TabsContent>

          <TabsContent value="full-attendance" className="mt-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <FullAttendanceReport embedded />
            </motion.div>
          </TabsContent>
        </Tabs>
      </motion.div>
    </DashboardLayout>
  );
}
