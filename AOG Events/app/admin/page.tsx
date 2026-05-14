"use client";

import { useState } from "react";
import { Header } from "@/components/header";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { DashboardOverview } from "@/components/admin/dashboard-overview";
import { EventManagement } from "@/components/admin/event-management";
import { RegistrationsList } from "@/components/admin/registrations-list";
import { VenueManagement } from "@/components/admin/venue-management";
import { ReportsExport } from "@/components/admin/reports-export";
import { SettingsPanel } from "@/components/admin/settings-panel";
import { EmailTemplatesPanel } from "@/components/admin/email-templates-panel";
import dynamic from "next/dynamic";

const CheckInSystem = dynamic(
  () => import("@/components/admin/check-in-system").then((mod) => mod.CheckInSystem),
  { ssr: false }
);

type AdminView = "overview" | "events" | "venues" | "registrations" | "reports" | "checkin" | "settings" | "email-templates";

export default function AdminPage() {
  const [activeView, setActiveView] = useState<AdminView>("overview");

  const renderContent = () => {
    switch (activeView) {
      case "overview":
        return <DashboardOverview />;
      case "events":
        return <EventManagement />;
      case "registrations":
        return <RegistrationsList />;
      case "venues":
        return <VenueManagement />;
      case "reports":
        return <ReportsExport />;
      case "checkin":
        return <CheckInSystem />;
      case "email-templates":
        return <EmailTemplatesPanel />;
      case "settings":
        return <SettingsPanel />;
      default:
        return <DashboardOverview />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="flex">
        <AdminSidebar activeView={activeView} onViewChange={setActiveView} />

        <main className="flex-1 p-6 md:p-8">{renderContent()}</main>
      </div>
    </div>
  );
}
