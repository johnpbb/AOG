"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { isRegistrationOnly } from "@/lib/roles";
import { Header } from "@/components/header";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { DashboardOverview } from "@/components/admin/dashboard-overview";
import { EventManagement } from "@/components/admin/event-management";
import { RegistrationsList } from "@/components/admin/registrations-list";
import { VenueManagement } from "@/components/admin/venue-management";
import { ReportsExport } from "@/components/admin/reports-export";
import { SettingsPanel } from "@/components/admin/settings-panel";
import { EmailTemplatesPanel } from "@/components/admin/email-templates-panel";
import { StaffAccountsPanel } from "@/components/admin/staff-accounts-panel";
import { BalanceLedgerPanel } from "@/components/admin/balance-ledger-panel";
import dynamic from "next/dynamic";

const CheckInSystem = dynamic(
  () => import("@/components/admin/check-in-system").then((mod) => mod.CheckInSystem),
  { ssr: false }
);

type AdminView = "overview" | "events" | "venues" | "registrations" | "ledger" | "reports" | "checkin" | "settings" | "email-templates" | "staff";

export default function AdminPage() {
  const router = useRouter();
  const [activeView, setActiveView] = useState<AdminView>("overview");
  // undefined = still loading; avoids flashing the dashboard at restricted staff.
  const [role, setRole] = useState<string | null | undefined>(undefined);

  // Registration Desk accounts only see the Registrations view. The server
  // enforces this too (middleware.ts); this just keeps the UI honest.
  useEffect(() => {
    fetch("/api/admin/me")
      .then((r) => {
        if (r.status === 401) {
          router.push("/admin/login");
          return null;
        }
        return r.json();
      })
      .then((data) => {
        const userRole = data?.user?.role ?? null;
        setRole(userRole);
        if (isRegistrationOnly(userRole)) setActiveView("registrations");
      })
      .catch(() => setRole(null));
  }, [router]);

  const registrationOnly = isRegistrationOnly(role);

  const renderContent = () => {
    if (role === undefined) {
      return (
        <div className="flex justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      );
    }
    if (registrationOnly) return <RegistrationsList registrationOnly />;
    switch (activeView) {
      case "overview":
        return <DashboardOverview />;
      case "events":
        return <EventManagement />;
      case "registrations":
        return <RegistrationsList />;
      case "venues":
        return <VenueManagement />;
      case "ledger":
        return <BalanceLedgerPanel />;
      case "reports":
        return <ReportsExport />;
      case "checkin":
        return <CheckInSystem />;
      case "email-templates":
        return <EmailTemplatesPanel />;
      case "staff":
        return <StaffAccountsPanel />;
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
        <AdminSidebar activeView={activeView} onViewChange={setActiveView} registrationOnly={registrationOnly} />

        <main className="flex-1 min-w-0 p-6 md:p-8">{renderContent()}</main>
      </div>
    </div>
  );
}
