import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Building2, CreditCard, CheckCircle, TrendingUp, MapPin, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export function DashboardOverview() {
  const [statsData, setStatsData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/stats');
      if (res.ok) {
        const data = await res.json();
        setStatsData(data);
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const { totalRegistrations, totalPayments, pendingPayments, recentRegistrations, categories } = statsData || {
    totalRegistrations: 0,
    totalPayments: 0,
    pendingPayments: 0,
    recentRegistrations: [],
    categories: [],
  };

  const venueCapacity = 21000;

  const stats = [
    {
      title: "Total Registrations",
      value: totalRegistrations.toLocaleString(),
      change: "Live data",
      icon: Users,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      title: "Confirmed Payments",
      value: totalPayments.toLocaleString(),
      change: `${pendingPayments.toLocaleString()} pending`,
      icon: CreditCard,
      color: "text-green-600",
      bgColor: "bg-green-100",
    },
    {
      title: "Pending Payments",
      value: pendingPayments.toLocaleString(),
      change: "Check bank transfers",
      icon: CreditCard,
      color: "text-amber-600",
      bgColor: "bg-amber-100",
    },
    {
      title: "Venue Capacity",
      value: `${Math.round((totalRegistrations / venueCapacity) * 100)}%`,
      change: `${(venueCapacity - totalRegistrations).toLocaleString()} seats left`,
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
              {recentRegistrations.length > 0 ? (
                recentRegistrations.map((reg: any) => {
                  const formData = reg.formData || {};
                  const name = `${formData.firstName || ""} ${formData.lastName || ""}`.trim() || reg.email;
                  return (
                    <div
                      key={reg.id}
                      className="flex items-center justify-between py-2 border-b border-border last:border-0"
                    >
                      <div>
                        <p className="font-medium text-foreground text-sm">{name}</p>
                        <p className="text-xs text-muted-foreground">
                          {reg.category} • {formatDistanceToNow(new Date(reg.createdAt))} ago
                        </p>
                      </div>
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${
                          reg.paymentStatus === "COMPLETED"
                            ? "bg-green-100 text-green-700"
                            : "bg-yellow-100 text-yellow-700"
                        }`}
                      >
                        {reg.paymentStatus === "COMPLETED" ? "Confirmed" : "Pending"}
                      </span>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-muted-foreground py-4">No registrations yet.</p>
              )}
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
              {categories.length > 0 ? (
                categories.map((cat: any) => (
                  <div key={cat.name} className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-blue-500" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-foreground capitalize">{cat.name.replace(/-/g, ' ')}</span>
                        <span className="text-muted-foreground">{cat.count}</span>
                      </div>
                      <div className="mt-1 h-2 rounded-full bg-secondary overflow-hidden">
                        <div
                          className="h-full bg-blue-500"
                          style={{
                            width: `${Math.max((cat.count / totalRegistrations) * 100, 2)}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground py-4">No data available.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
