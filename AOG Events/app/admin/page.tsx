"use client";

import { useState } from "react";
import { Header } from "@/components/header";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { DashboardOverview } from "@/components/admin/dashboard-overview";
import { RegistrationsList } from "@/components/admin/registrations-list";
import { VenueManagement } from "@/components/admin/venue-management";
import { ReportsExport } from "@/components/admin/reports-export";
import dynamic from "next/dynamic";

const CheckInSystem = dynamic(
  () => import("@/components/admin/check-in-system").then((mod) => mod.CheckInSystem),
  { ssr: false }
);

type AdminView = "overview" | "registrations" | "venues" | "reports" | "checkin";

export default function AdminPage() {
  const [activeView, setActiveView] = useState<AdminView>("overview");

  const renderContent = () => {
    switch (activeView) {
      case "overview":
        return <DashboardOverview />;
      case "registrations":
        return <RegistrationsList />;
      case "venues":
        return <VenueManagement />;
      case "reports":
        return <ReportsExport />;
      case "checkin":
        return <CheckInSystem />;
      default:
        return <DashboardOverview />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="flex">
        <AdminSidebar activeView={activeView} onViewChange={setActiveView} />
        
        <main className="flex-1 p-6 md:p-8">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}
