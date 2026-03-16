"use client";

import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  MapPin,
  FileText,
  QrCode,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

type AdminView = "overview" | "registrations" | "venues" | "reports" | "checkin";

interface AdminSidebarProps {
  activeView: AdminView;
  onViewChange: (view: AdminView) => void;
}

const navItems = [
  { id: "overview" as const, label: "Dashboard", icon: LayoutDashboard },
  { id: "registrations" as const, label: "Registrations", icon: Users },
  { id: "venues" as const, label: "Venues", icon: MapPin },
  { id: "reports" as const, label: "Reports", icon: FileText },
  { id: "checkin" as const, label: "Check-In", icon: QrCode },
];

export function AdminSidebar({ activeView, onViewChange }: AdminSidebarProps) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile Toggle */}
      <Button
        variant="outline"
        size="icon"
        className="fixed bottom-4 right-4 z-50 md:hidden shadow-lg"
        onClick={() => setIsMobileOpen(!isMobileOpen)}
      >
        {isMobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed md:sticky top-16 left-0 z-40 h-[calc(100vh-4rem)] w-64 border-r border-border bg-card transition-transform md:translate-x-0",
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex flex-col h-full p-4">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-foreground">Admin Panel</h2>
            <p className="text-sm text-muted-foreground">Manage event registrations</p>
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  onViewChange(item.id);
                  setIsMobileOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  activeView === item.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </button>
            ))}
          </nav>

          <div className="mt-auto pt-4 border-t border-border">
            <div className="text-xs text-muted-foreground">
              AOG FJ 100th Admin v1.0
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
