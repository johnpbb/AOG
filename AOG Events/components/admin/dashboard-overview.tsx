"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Building2, CreditCard, CheckCircle, TrendingUp, MapPin } from "lucide-react";

// Mock data for demonstration
const mockStats = {
  totalRegistrations: 15234,
  totalChurches: 387,
  totalPayments: 12890,
  checkedIn: 0,
  venueCapacity: 21000,
  pendingPayments: 2344,
};

const recentRegistrations = [
  { id: "AOG100-ABC123", name: "First Assembly Suva", type: "Large Church", date: "2 min ago", status: "Confirmed" },
  { id: "AOG100-DEF456", name: "John Doe", type: "Individual", date: "5 min ago", status: "Pending" },
  { id: "AOG100-GHI789", name: "Grace Church Nadi", type: "Medium Church", date: "12 min ago", status: "Confirmed" },
  { id: "AOG100-JKL012", name: "Jane Smith", type: "WFC Partner", date: "15 min ago", status: "Confirmed" },
  { id: "AOG100-MNO345", name: "Living Waters", type: "Small Church", date: "20 min ago", status: "Pending" },
];

const categoryBreakdown = [
  { name: "Very Large Church", count: 45, color: "bg-blue-500" },
  { name: "Large Church", count: 89, color: "bg-blue-400" },
  { name: "Medium Church", count: 120, color: "bg-blue-300" },
  { name: "Small Church", count: 98, color: "bg-cyan-500" },
  { name: "Church Plant", count: 35, color: "bg-cyan-400" },
  { name: "WFC", count: 0, color: "bg-teal-500" },
  { name: "WFC Partners", count: 0, color: "bg-teal-400" },
  { name: "Individual", count: 0, color: "bg-green-500" },
];

export function DashboardOverview() {
  const stats = [
    {
      title: "Total Registrations",
      value: mockStats.totalRegistrations.toLocaleString(),
      change: "+12% from last week",
      icon: Users,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      title: "Churches Registered",
      value: mockStats.totalChurches.toLocaleString(),
      change: `${Math.round((mockStats.totalChurches / 415) * 100)}% of target`,
      icon: Building2,
      color: "text-green-600",
      bgColor: "bg-green-100",
    },
    {
      title: "Confirmed Payments",
      value: mockStats.totalPayments.toLocaleString(),
      change: `${mockStats.pendingPayments.toLocaleString()} pending`,
      icon: CreditCard,
      color: "text-amber-600",
      bgColor: "bg-amber-100",
    },
    {
      title: "Venue Capacity",
      value: `${Math.round((mockStats.totalRegistrations / mockStats.venueCapacity) * 100)}%`,
      change: `${(mockStats.venueCapacity - mockStats.totalRegistrations).toLocaleString()} seats left`,
      icon: MapPin,
      color: "text-purple-600",
      bgColor: "bg-purple-100",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard Overview</h1>
        <p className="text-muted-foreground">
          Monitor registrations and event statistics in real-time.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                  <p className="text-2xl font-bold text-foreground mt-1">
                    {stat.value}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" />
                    {stat.change}
                  </p>
                </div>
                <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Registrations */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Registrations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentRegistrations.map((reg) => (
                <div
                  key={reg.id}
                  className="flex items-center justify-between py-2 border-b border-border last:border-0"
                >
                  <div>
                    <p className="font-medium text-foreground text-sm">{reg.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {reg.type} • {reg.date}
                    </p>
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      reg.status === "Confirmed"
                        ? "bg-green-100 text-green-700"
                        : "bg-yellow-100 text-yellow-700"
                    }`}
                  >
                    {reg.status}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Category Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Registration by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {categoryBreakdown.map((cat) => (
                <div key={cat.name} className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${cat.color}`} />
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-foreground">{cat.name}</span>
                      <span className="text-muted-foreground">{cat.count}</span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-secondary overflow-hidden">
                      <div
                        className={`h-full ${cat.color}`}
                        style={{
                          width: `${Math.max((cat.count / 150) * 100, 2)}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
