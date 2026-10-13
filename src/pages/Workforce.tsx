import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, ClipboardCheck, Fingerprint, MapPin, History } from "lucide-react";
import { motion } from "framer-motion";
import Workers from "./Workers";
import Attendance from "./Attendance";
import AttendanceHistory from "./AttendanceHistory";
import BiometricAttendance from "./BiometricAttendance";
import WorkAllocationHistory from "./WorkAllocationHistory";

export default function Workforce() {
  const [activeTab, setActiveTab] = useState("workers");

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
            <Users className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
              Workforce Management
            </h1>
            <p className="text-sm text-muted-foreground">Manage workers, track attendance, and oversee site work allocations</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="glass-card p-1 border border-primary/10 h-12 flex-wrap">
            <TabsTrigger 
              value="workers" 
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-accent data-[state=active]:text-white transition-all px-5 py-2 text-sm font-medium gap-2"
            >
              <Users className="w-4 h-4" />
              Workers
            </TabsTrigger>
            <TabsTrigger 
              value="attendance"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-accent data-[state=active]:text-white transition-all px-5 py-2 text-sm font-medium gap-2"
            >
              <ClipboardCheck className="w-4 h-4" />
              Live Attendance
            </TabsTrigger>
            <TabsTrigger 
              value="history"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-accent data-[state=active]:text-white transition-all px-5 py-2 text-sm font-medium gap-2"
            >
              <History className="w-4 h-4" />
              Attendance History &amp; Groups
            </TabsTrigger>
            <TabsTrigger 
              value="biometric"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-accent data-[state=active]:text-white transition-all px-5 py-2 text-sm font-medium gap-2"
            >
              <Fingerprint className="w-4 h-4" />
              Biometric
            </TabsTrigger>
            <TabsTrigger 
              value="allocation"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-accent data-[state=active]:text-white transition-all px-5 py-2 text-sm font-medium gap-2"
            >
              <MapPin className="w-4 h-4" />
              Work Allocation
            </TabsTrigger>
          </TabsList>

          <TabsContent value="workers" className="mt-6">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Workers embedded />
            </motion.div>
          </TabsContent>

          <TabsContent value="attendance" className="mt-6">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Attendance embedded />
            </motion.div>
          </TabsContent>

          <TabsContent value="history" className="mt-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <AttendanceHistory embedded />
            </motion.div>
          </TabsContent>

          <TabsContent value="biometric" className="mt-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <BiometricAttendance embedded />
            </motion.div>
          </TabsContent>

          <TabsContent value="allocation" className="mt-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <WorkAllocationHistory embedded />
            </motion.div>
          </TabsContent>
        </Tabs>
      </motion.div>
    </DashboardLayout>
  );
}
