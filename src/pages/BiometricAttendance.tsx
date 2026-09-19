import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FingerprintScanner } from "@/components/FingerprintScanner";
import { FaceScanner } from "@/components/FaceScanner";
import { Fingerprint, Scan } from "lucide-react";
import { motion } from "framer-motion";

interface BiometricAttendanceProps {
  embedded?: boolean;
}

export default function BiometricAttendance({ embedded = false }: BiometricAttendanceProps) {
  const [lastMarkedId, setLastMarkedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"face" | "fingerprint">("face");

  const handleAttendanceMarked = (workerId: string, type: 'in' | 'out') => {
    setLastMarkedId(workerId);
  };

  const content = (
    <div className="max-w-2xl mx-auto space-y-6">
      {!embedded && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg">
            <Scan className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent mb-2">
            Biometric Attendance
          </h1>
          <p className="text-muted-foreground">
            Use face recognition or fingerprint scanner for secure attendance
          </p>
        </motion.div>
      )}

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
        <TabsList className="glass-card p-1 border border-primary/10 h-12 w-full grid grid-cols-2">
          <TabsTrigger 
            value="face" 
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-accent data-[state=active]:text-white transition-all gap-2"
          >
            <Scan className="w-4 h-4" />
            Face Scan
          </TabsTrigger>
          <TabsTrigger 
            value="fingerprint"
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-accent data-[state=active]:text-white transition-all gap-2"
          >
            <Fingerprint className="w-4 h-4" />
            Fingerprint
          </TabsTrigger>
        </TabsList>

        <TabsContent value="face" className="mt-6">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
          >
            <FaceScanner onAttendanceMarked={handleAttendanceMarked} />
          </motion.div>
        </TabsContent>

        <TabsContent value="fingerprint" className="mt-6">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
          >
            <FingerprintScanner onAttendanceMarked={handleAttendanceMarked} />
          </motion.div>
        </TabsContent>
      </Tabs>
    </div>
  );

  if (embedded) return content;
  return <DashboardLayout>{content}</DashboardLayout>;
}
