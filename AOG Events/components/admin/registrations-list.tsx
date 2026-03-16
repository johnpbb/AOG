"use client";

import { useState } from "react";
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
import { Search, Filter, Eye, MoreHorizontal, Download } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Mock data
const mockRegistrations = [
  {
    id: "AOG100-ABC123",
    name: "First Assembly Suva",
    category: "Large Church",
    attendees: 45,
    email: "pastor@firstassembly.fj",
    phone: "+679 123 4567",
    venue: "Main Arena",
    payment: "Confirmed",
    date: "2026-03-01",
  },
  {
    id: "AOG100-DEF456",
    name: "John Doe",
    category: "Individual",
    attendees: 1,
    email: "john@email.com",
    phone: "+679 234 5678",
    venue: "Conference Hall",
    payment: "Pending",
    date: "2026-03-02",
  },
  {
    id: "AOG100-GHI789",
    name: "Grace Church Nadi",
    category: "Medium Church",
    attendees: 28,
    email: "info@gracechurch.fj",
    phone: "+679 345 6789",
    venue: "Main Arena",
    payment: "Confirmed",
    date: "2026-03-02",
  },
  {
    id: "AOG100-JKL012",
    name: "Jane Smith",
    category: "WFC Partner",
    attendees: 1,
    email: "jane@mission.org",
    phone: "+679 456 7890",
    venue: "Conference Hall",
    payment: "Confirmed",
    date: "2026-03-03",
  },
  {
    id: "AOG100-MNO345",
    name: "Living Waters Church",
    category: "Small Church",
    attendees: 15,
    email: "pastor@livingwaters.fj",
    phone: "+679 567 8901",
    venue: "Overflow Venue",
    payment: "Pending",
    date: "2026-03-03",
  },
];

export function RegistrationsList() {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");

  const filteredRegistrations = mockRegistrations.filter((reg) => {
    const matchesSearch =
      reg.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      reg.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      reg.email.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory =
      categoryFilter === "all" || reg.category === categoryFilter;

    const matchesPayment =
      paymentFilter === "all" || reg.payment === paymentFilter;

    return matchesSearch && matchesCategory && matchesPayment;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Registrations</h1>
          <p className="text-muted-foreground">
            Manage and view all event registrations.
          </p>
        </div>
        <Button variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

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
                <SelectItem value="Very Large Church">Very Large Church</SelectItem>
                <SelectItem value="Large Church">Large Church</SelectItem>
                <SelectItem value="Medium Church">Medium Church</SelectItem>
                <SelectItem value="Small Church">Small Church</SelectItem>
                <SelectItem value="Church Plant">Church Plant</SelectItem>
                <SelectItem value="WFC">World Fijian Congress</SelectItem>
                <SelectItem value="WFC Partner">WFC Partner</SelectItem>
                <SelectItem value="Individual">Individual</SelectItem>
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
                  <TableHead className="text-center">Attendees</TableHead>
                  <TableHead>Venue</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRegistrations.map((reg) => (
                  <TableRow key={reg.id}>
                    <TableCell className="font-mono text-sm">{reg.id}</TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium text-foreground">{reg.name}</div>
                        <div className="text-xs text-muted-foreground">{reg.email}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{reg.category}</span>
                    </TableCell>
                    <TableCell className="text-center">{reg.attendees}</TableCell>
                    <TableCell>{reg.venue}</TableCell>
                    <TableCell>
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${
                          reg.payment === "Confirmed"
                            ? "bg-green-100 text-green-700"
                            : "bg-yellow-100 text-yellow-700"
                        }`}
                      >
                        {reg.payment}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {reg.date}
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
                          <DropdownMenuItem>Edit Registration</DropdownMenuItem>
                          <DropdownMenuItem>Resend QR Code</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive">
                            Cancel Registration
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
