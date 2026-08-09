"use client";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Filter, Eye, MoreHorizontal, Download, Upload, Loader2, XCircle, CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { RegistrationsCsvImporter } from "./registrations-csv-importer";

// All manual/offline methods eligible for one-click approval — every method
// except ONLINE (disabled for now) requires the finance team's manual verification.
const MANUAL_PAYMENT_METHODS = ["BANK_TRANSFER", "MPAISA", "WORLD_REMIT"];

export function RegistrationsList() {
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [showImporter, setShowImporter] = useState(false);

  useEffect(() => {
    fetchRegistrations();
  }, []);

  // `silent` skips the loading-spinner branch below, which otherwise
  // unmounts this component's children (e.g. the CSV importer panel) on
  // every background refresh, wiping their state. Used when refreshing after
  // an action within an already-open panel rather than the initial load.
  const fetchRegistrations = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await fetch('/api/admin/registrations');
      if (res.ok) {
        const data = await res.json();
        setRegistrations(data);
      }
    } catch (error) {
      console.error("Error fetching registrations:", error);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleApprove = async (reg: any) => {
    const confirmed = window.confirm(
      `Approve registration ${reg.registrationId} for ${reg.formData?.churchName ?? reg.formData?.firstName ?? reg.email}?\n\nThis will mark the payment as confirmed and send tickets to ${reg.email}.`
    );
    if (!confirmed) return;

    setApprovingId(reg.id);
    try {
      const res = await fetch(`/api/admin/registrations/${reg.id}`, { method: "PATCH" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to approve");
      await fetchRegistrations();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setApprovingId(null);
    }
  };

  const handleCancel = async (reg: any) => {
    const confirmed = window.confirm(
      `Cancel registration ${reg.registrationId}?\n\n` +
      `This will:\n• Mark the registration as Cancelled\n• Invalidate ${reg.tickets?.length ?? reg.numberOfAttendees} QR ticket(s)\n• Return seats to the venue pool(s)\n\nThis cannot be undone.`
    );
    if (!confirmed) return;

    setCancellingId(reg.id);
    try {
      const res = await fetch(`/api/admin/registrations/${reg.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to cancel");
      // Refresh list
      await fetchRegistrations();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCancellingId(null);
    }
  };

  const filteredRegistrations = registrations.filter((reg) => {
    const formData = reg.formData || {};
    const firstName = formData.firstName || "";
    const lastName = formData.lastName || "";
    const name = `${firstName} ${lastName}`.trim() || reg.email;

    const matchesSearch =
      name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      reg.registrationId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      reg.email.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory =
      categoryFilter === "all" || reg.category === categoryFilter;

    const matchesPayment =
      paymentFilter === "all" || 
      (paymentFilter === "Confirmed" && reg.paymentStatus === "COMPLETED") ||
      (paymentFilter === "Pending" && reg.paymentStatus === "PENDING");

    return matchesSearch && matchesCategory && matchesPayment;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Registrations</h1>
          <p className="text-muted-foreground">
            Manage and view all event registrations.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => setShowImporter((v) => !v)}>
            <Upload className="h-4 w-4" />
            Import CSV
          </Button>
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {showImporter && (
        <RegistrationsCsvImporter
          onImported={() => { fetchRegistrations(true); }}
          onClose={() => setShowImporter(false)}
        />
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, ID, or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="very-large-church">Very Large Church</SelectItem>
                <SelectItem value="large-church">Large Church</SelectItem>
                <SelectItem value="medium-church">Medium Church</SelectItem>
                <SelectItem value="small-church">Small Church</SelectItem>
                <SelectItem value="individual">Individual</SelectItem>
                <SelectItem value="overseas-delegates">Overseas Delegates</SelectItem>
              </SelectContent>
            </Select>
            <Select value={paymentFilter} onValueChange={setPaymentFilter}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="Payment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Payments</SelectItem>
                <SelectItem value="Confirmed">Confirmed</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            All Registrations ({filteredRegistrations.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Registration ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-center">Tickets</TableHead>
                  <TableHead>Venue</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRegistrations.map((reg, idx) => {
                  const formData = reg.formData || {};
                  const name = `${formData.firstName || ""} ${formData.lastName || ""}`.trim() || reg.email;

                  return (
                    <TableRow key={reg.id} className={`${idx % 2 === 1 ? "bg-muted/20" : ""} ${reg.paymentStatus === "CANCELLED" ? "opacity-50" : ""}`}>
                      <TableCell className="font-mono text-sm">{reg.registrationId}</TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium text-foreground">
                            {reg.formData?.churchName ?? name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {reg.email}
                            {reg.category === "overseas-delegates" && formData.country ? ` · ${formData.country}` : ""}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm capitalize">{reg.category.replace(/-/g, ' ')}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-medium">{reg.tickets?.length ?? reg.numberOfAttendees}</span>
                        {reg.tickets?.length > 0 && (
                          <span className="text-xs text-muted-foreground ml-1">ticket{reg.tickets.length !== 1 ? "s" : ""}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {reg.venueAllocations?.length > 0 ? (
                          <span className="text-sm">
                            {reg.venueAllocations
                              .map((a: any) => `${a.venue.name} (${a.count} ${a.audienceType})`)
                              .join(", ")}
                          </span>
                        ) : reg.venue?.name ? (
                          <span className="text-sm">{reg.venue.name}</span>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              reg.paymentStatus === "COMPLETED" ? "success"
                              : reg.paymentStatus === "CANCELLED" ? "outline"
                              : "secondary"
                            }
                            className={reg.paymentStatus === "CANCELLED" ? "line-through" : ""}
                          >
                            {reg.paymentStatus === "COMPLETED" ? "Confirmed"
                              : reg.paymentStatus === "CANCELLED" ? "Cancelled"
                              : "Pending"}
                          </Badge>
                          {reg.paymentStatus === "PENDING" && MANUAL_PAYMENT_METHODS.includes(reg.paymentMethod) && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-xs gap-1 border-green-300 text-green-700 hover:bg-green-50"
                              disabled={approvingId === reg.id}
                              onClick={() => handleApprove(reg)}
                            >
                              {approvingId === reg.id
                                ? <Loader2 className="h-3 w-3 animate-spin" />
                                : <><CheckCircle className="h-3 w-3" /> Approve</>}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(reg.createdAt), "yyyy-MM-dd")}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            {reg.paymentStatus === "PENDING" && MANUAL_PAYMENT_METHODS.includes(reg.paymentMethod) && (
                              <DropdownMenuItem
                                className="text-green-700 focus:text-green-700"
                                disabled={approvingId === reg.id}
                                onClick={() => handleApprove(reg)}
                              >
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Verify & Approve
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              disabled={reg.paymentStatus === "CANCELLED" || cancellingId === reg.id}
                              onClick={() => handleCancel(reg)}
                            >
                              {cancellingId === reg.id
                                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Cancelling...</>
                                : <><XCircle className="h-4 w-4 mr-2" />Cancel Registration</>}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
