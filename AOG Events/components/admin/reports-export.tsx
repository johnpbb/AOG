"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Download,
  FileSpreadsheet,
  FileText,
  Calendar,
  Filter,
  Loader2,
} from "lucide-react";
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field";

type Format = "csv" | "xlsx";
type DateRange = "all" | "today" | "week" | "month";
type CategoryFilter = "all" | "churches" | "individuals";

const reportTypes = [
  {
    id: "registrations",
    title: "Registration Report",
    description: "Complete list of all registrations with attendee details",
    icon: FileSpreadsheet,
  },
  {
    id: "payments",
    title: "Payment Status Report",
    description: "Payment confirmations, pending transactions and revenue totals",
    icon: FileText,
  },
  {
    id: "venues",
    title: "Venue Capacity Report",
    description: "Venue utilization and remaining capacity",
    icon: FileText,
  },
  {
    id: "categories",
    title: "Category Breakdown",
    description: "Registration counts, attendees and revenue by category",
    icon: FileSpreadsheet,
  },
  {
    id: "checkin",
    title: "Check-In Report",
    description: "Attendance tracking and check-in history per ticket",
    icon: FileText,
  },
  {
    id: "churches",
    title: "Church Directory",
    description: "All registered churches with pastor and contact details",
    icon: FileSpreadsheet,
  },
  {
    id: "ledger",
    title: "Finance Ledger",
    description: "Total fee, amount paid, and remaining balance per registration",
    icon: FileText,
  },
];

export function ReportsExport() {
  const [dateRange, setDateRange] = useState<DateRange>("all");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [quickFormat, setQuickFormat] = useState<Format>("csv");
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function download(type: string, format: Format) {
    const key = `${type}-${format}`;
    setLoading(key);
    setError(null);
    try {
      const params = new URLSearchParams({ type, format, dateRange, category });
      const res = await fetch(`/api/admin/reports?${params}`);
      if (!res.ok) throw new Error(`Server error ${res.status}`);

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const date = new Date().toISOString().split("T")[0];
      a.download = `${type}-${date}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setError(`Failed to download ${type} report. Please try again.`);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Reports & Export</h1>
        <p className="text-muted-foreground">
          Generate and download reports for administration.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Quick Export */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quick Export</CardTitle>
          <CardDescription>
            Download a complete export of all registration data with filters applied
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup className="grid gap-4 md:grid-cols-3">
            <Field>
              <FieldLabel>Date Range</FieldLabel>
              <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
                <SelectTrigger>
                  <Calendar className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>Category Filter</FieldLabel>
              <Select value={category} onValueChange={(v) => setCategory(v as CategoryFilter)}>
                <SelectTrigger>
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="churches">Churches Only</SelectItem>
                  <SelectItem value="individuals">Individuals Only</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>Format</FieldLabel>
              <Select value={quickFormat} onValueChange={(v) => setQuickFormat(v as Format)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="csv">CSV (.csv)</SelectItem>
                  <SelectItem value="xlsx">Excel (.xlsx)</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </FieldGroup>
          <Button
            className="mt-4 gap-2"
            onClick={() => download("registrations", quickFormat)}
            disabled={loading !== null}
          >
            {loading === `registrations-${quickFormat}` ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Export All Data
          </Button>
        </CardContent>
      </Card>

      {/* Individual Reports */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {reportTypes.map((report) => (
          <Card key={report.id}>
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg bg-secondary">
                  <report.icon className="h-5 w-5 text-foreground" />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-foreground">{report.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {report.description}
                  </p>
                  <div className="flex gap-2 mt-4">
                    {(["csv", "xlsx"] as Format[]).map((fmt) => {
                      const key = `${report.id}-${fmt}`;
                      const isLoading = loading === key;
                      return (
                        <Button
                          key={fmt}
                          variant="outline"
                          size="sm"
                          disabled={loading !== null}
                          onClick={() => download(report.id, fmt)}
                          className="gap-1.5"
                        >
                          {isLoading ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Download className="h-3.5 w-3.5" />
                          )}
                          {fmt.toUpperCase()}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Date range and category filters apply to all reports except Venue Capacity.
      </p>
    </div>
  );
}
