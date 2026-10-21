import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { ThemeProvider } from "next-themes";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { PageTransition } from "@/components/PageTransition";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { CompanyProvider } from "@/context/CompanyContext";
import { isSupabaseConfigured } from "@/integrations/supabase/client";
import { ConfigRequired } from "@/components/ConfigRequired";
import { ErrorBoundary } from "@/components/ErrorBoundary";

import Index from "./pages/Index";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import Workforce from "./pages/Workforce";
import Projects from "./pages/Projects";
import ProjectDetail from "./pages/ProjectDetail";
import ReportsHub from "./pages/ReportsHub";
import WorkerHistory from "./pages/WorkerHistory";
import Admin from "./pages/Admin";
import Profile from "./pages/Profile";
import SupervisorAttendance from "./pages/SupervisorAttendance";
import Notifications from "./pages/Notifications";
import NotFound from "./pages/NotFound";
import WorkerAttendance from "./pages/WorkerAttendance";
import PublicBiometricAttendance from "./pages/PublicBiometricAttendance";
import AttendanceHistory from "./pages/AttendanceHistory";
import WorkAllocationHistory from "./pages/WorkAllocationHistory";
import Methodologies from "./pages/Methodologies";
import Checklists from "./pages/Checklists";
import ChecklistBuilder from "./pages/ChecklistBuilder";
import MyChecklists from "./pages/MyChecklists";
import FillChecklist from "./pages/FillChecklist";
import OAuthConsent from "./pages/OAuthConsent";
import DprHub from "./pages/DprHub";
import DprWizard from "./pages/DprWizard";
import DprReview from "./pages/DprReview";
import DprOverview from "./pages/DprOverview";
import CompanySettings from "./pages/CompanySettings";
import SuperAdmin from "./pages/SuperAdmin";
import AccessSuspended from "./pages/AccessSuspended";
import StageQualityStandards from "./pages/StageQualityStandards";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import Sitemap from "./pages/Sitemap";

const queryClient = new QueryClient();

const AnimatedRoutes = () => {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        {/* ── Public routes ─────────────────────────────────────── */}
        <Route path="/" element={<PageTransition><Index /></PageTransition>} />
        <Route path="/privacy" element={<PageTransition><PrivacyPolicy /></PageTransition>} />
        <Route path="/terms" element={<PageTransition><TermsOfService /></PageTransition>} />
        <Route path="/sitemap" element={<PageTransition><Sitemap /></PageTransition>} />
        <Route path="/attendance-scan" element={<PageTransition><PublicBiometricAttendance /></PageTransition>} />
        <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
        <Route
          path="/super-admin"
          element={
            <ProtectedRoute requireAuth skipCompanyCheck>
              <PageTransition><SuperAdmin /></PageTransition>
            </ProtectedRoute>
          }
        />
        <Route path="/access-suspended" element={<PageTransition><AccessSuspended /></PageTransition>} />

        {/* ── Onboarding (auth required, no company needed yet) ── */}
        <Route
          path="/onboarding"
          element={
            <ProtectedRoute skipCompanyCheck requireAuth>
              <PageTransition><Onboarding /></PageTransition>
            </ProtectedRoute>
          }
        />

        {/* ── Admin + management + supervisor ────────────────────── */}
        <Route path="/dashboard" element={
          <ProtectedRoute allowedRoles={["admin", "management", "supervisor"]}>
            <PageTransition><Dashboard /></PageTransition>
          </ProtectedRoute>
        } />
        <Route path="/workforce" element={
          <ProtectedRoute allowedRoles={["admin", "management", "supervisor"]}>
            <PageTransition><Workforce /></PageTransition>
          </ProtectedRoute>
        } />
        <Route path="/projects" element={
          <ProtectedRoute allowedRoles={["admin", "management", "supervisor"]}>
            <PageTransition><Projects /></PageTransition>
          </ProtectedRoute>
        } />
        <Route path="/projects/:id" element={
          <ProtectedRoute allowedRoles={["admin", "management", "supervisor"]}>
            <PageTransition><ProjectDetail /></PageTransition>
          </ProtectedRoute>
        } />
        <Route path="/projects/:projectId/checklists/:pcId/fill" element={
          <ProtectedRoute allowedRoles={["admin", "supervisor"]}>
            <PageTransition><FillChecklist /></PageTransition>
          </ProtectedRoute>
        } />
        <Route path="/stage-standards" element={
          <ProtectedRoute allowedRoles={["admin", "management", "supervisor"]}>
            <PageTransition><StageQualityStandards /></PageTransition>
          </ProtectedRoute>
        } />
        <Route path="/methodologies" element={
          <ProtectedRoute allowedRoles={["admin", "management", "supervisor"]}>
            <PageTransition><StageQualityStandards /></PageTransition>
          </ProtectedRoute>
        } />
        <Route path="/checklists" element={
          <ProtectedRoute allowedRoles={["admin", "management", "supervisor"]}>
            <PageTransition><StageQualityStandards /></PageTransition>
          </ProtectedRoute>
        } />
        <Route path="/checklists/new" element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <PageTransition><ChecklistBuilder /></PageTransition>
          </ProtectedRoute>
        } />
        <Route path="/checklists/:id/edit" element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <PageTransition><ChecklistBuilder /></PageTransition>
          </ProtectedRoute>
        } />
        <Route path="/my-checklists" element={
          <ProtectedRoute allowedRoles={["admin", "management", "supervisor"]}>
            <PageTransition><MyChecklists /></PageTransition>
          </ProtectedRoute>
        } />
        <Route path="/reports" element={
          <ProtectedRoute allowedRoles={["admin", "management"]}>
            <PageTransition><ReportsHub /></PageTransition>
          </ProtectedRoute>
        } />
        <Route path="/reports/worker/:workerId" element={
          <ProtectedRoute allowedRoles={["admin", "management"]}>
            <PageTransition><WorkerHistory /></PageTransition>
          </ProtectedRoute>
        } />
        <Route path="/admin" element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <PageTransition><Admin /></PageTransition>
          </ProtectedRoute>
        } />
        <Route path="/company-settings" element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <PageTransition><CompanySettings /></PageTransition>
          </ProtectedRoute>
        } />
        <Route path="/profile" element={
          <ProtectedRoute allowedRoles={["admin", "management", "supervisor", "worker"]}>
            <PageTransition><Profile /></PageTransition>
          </ProtectedRoute>
        } />
        <Route path="/my-attendance" element={
          <ProtectedRoute allowedRoles={["admin", "supervisor"]}>
            <PageTransition><SupervisorAttendance /></PageTransition>
          </ProtectedRoute>
        } />
        <Route path="/notifications" element={
          <ProtectedRoute allowedRoles={["admin", "management", "supervisor"]}>
            <PageTransition><Notifications /></PageTransition>
          </ProtectedRoute>
        } />
        <Route path="/attendance-history" element={
          <ProtectedRoute allowedRoles={["admin", "management", "supervisor"]}>
            <PageTransition><AttendanceHistory /></PageTransition>
          </ProtectedRoute>
        } />
        <Route path="/work-allocation-history" element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <PageTransition><WorkAllocationHistory /></PageTransition>
          </ProtectedRoute>
        } />
        <Route path="/dpr" element={
          <ProtectedRoute allowedRoles={["admin", "management", "supervisor"]}>
            <PageTransition><DprHub /></PageTransition>
          </ProtectedRoute>
        } />
        <Route path="/dpr/overview" element={
          <ProtectedRoute allowedRoles={["admin", "management"]}>
            <PageTransition><DprOverview /></PageTransition>
          </ProtectedRoute>
        } />
        <Route path="/dpr/:dprId/review" element={
          <ProtectedRoute allowedRoles={["admin", "management", "supervisor"]}>
            <PageTransition><DprReview /></PageTransition>
          </ProtectedRoute>
        } />
        <Route path="/projects/:id/dpr/:dprId" element={
          <ProtectedRoute allowedRoles={["admin", "management", "supervisor"]}>
            <PageTransition><DprWizard /></PageTransition>
          </ProtectedRoute>
        } />
        <Route path="/worker-attendance" element={
          <ProtectedRoute allowedRoles={["admin", "supervisor"]}>
            <PageTransition><WorkerAttendance /></PageTransition>
          </ProtectedRoute>
        } />

        <Route path="*" element={<PageTransition><NotFound /></PageTransition>} />
      </Routes>
    </AnimatePresence>
  );
};

const App = () => {
  if (!isSupabaseConfigured) {
    return <ConfigRequired />;
  }

  return (
    <ErrorBoundary>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <OfflineIndicator />
            <BrowserRouter>
              <CompanyProvider>
                <AnimatedRoutes />
              </CompanyProvider>
            </BrowserRouter>
          </TooltipProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
};

export default App;
