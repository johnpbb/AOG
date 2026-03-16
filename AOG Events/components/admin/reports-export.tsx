"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, FileSpreadsheet, FileText, Calendar, Filter } from "lucide-react";
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field";

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
    description: "Payment confirmations and pending transactions",
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
    description: "Registration counts by category",
    icon: FileSpreadsheet,
  },
  {
    id: "checkin",
    title: "Check-In Report",
    description: "Attendance tracking and check-in statistics",
    icon: FileText,
  },
  {
    id: "churches",
    title: "Church Directory",
    description: "List of all registered churches with contact info",
    icon: FileSpreadsheet,
  },
];

export function ReportsExport() {
  const handleExport = (reportId: string, format: string) => {
    console.log(`Exporting ${reportId} as ${format}`);
    // In a real app, this would trigger a download
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Reports & Export</h1>
        <p className="text-muted-foreground">
          Generate and download reports for administration.
        </p>
      </div>

      {/* Quick Export */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quick Export</CardTitle>
          <CardDescription>
            Download a complete export of all registration data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup className="grid gap-4 md:grid-cols-3">
            <Field>
              <FieldLabel>Date Range</FieldLabel>
              <Select defaultValue="all">
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
              <Select defaultValue="all">
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
              <Select defaultValue="csv">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="csv">CSV (.csv)</SelectItem>
                  <SelectItem value="xlsx">Excel (.xlsx)</SelectItem>
                  <SelectItem value="pdf">PDF (.pdf)</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </FieldGroup>
          <Button className="mt-4 gap-2">
            <Download className="h-4 w-4" />
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
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleExport(report.id, "csv")}
                    >
                      CSV
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleExport(report.id, "xlsx")}
                    >
                      Excel
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Scheduled Reports */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Scheduled Reports</CardTitle>
          <CardDescription>
            Set up automatic report generation and email delivery
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-secondary/30">
            <div>
              <p className="font-medium text-foreground">Daily Summary Report</p>
              <p className="text-sm text-muted-foreground">
                Sent daily at 6:00 AM to admin@aog100.fj
              </p>
            </div>
            <Button variant="outline" size="sm">
              Configure
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
