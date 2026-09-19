import { ReactNode } from "react";
import { Navbar } from "@/components/Navbar";
import { BottomNav } from "@/components/BottomNav";
import heroBg from "@/assets/hero-bg.jpg";

interface DashboardLayoutProps {
  children: ReactNode;
}

export const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  return (
    <div className="min-h-screen w-full relative overflow-hidden">
      {/* Atmospheric background image */}
      <div className="fixed inset-0">
        <img
          src={heroBg}
          alt=""
          className="w-full h-full object-cover opacity-[0.08] dark:opacity-[0.06]"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-background/95 via-background/90 to-background/95" />
        <div className="absolute inset-0 bg-gradient-to-b from-primary/3 via-transparent to-accent/3" />
      </div>

      {/* Top Navigation */}
      <div className="relative z-10">
        <Navbar />
      </div>

      {/* Main content area */}
      <main className="relative z-10 max-w-7xl mx-auto p-4 md:p-8 pb-24 lg:pb-8">
        {children}
      </main>

      {/* Mobile bottom navigation */}
      <BottomNav />
    </div>
  );
};
