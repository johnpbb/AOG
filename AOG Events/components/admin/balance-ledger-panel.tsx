"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Search, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { LogPaymentDialog } from "./log-payment-dialog";

interface LedgerRow {
  id: string;
  registrationId: string;
  churchName: string | null;
  category: string;
  totalFee: number;
  amountPaid: number;
  remainingBalance: number;
  paymentType: string;
  installmentCount: number | null;
  installmentDeadline: string | null;
  paymentStatus: string;
}

export function BalanceLedgerPanel() {
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeRow, setActiveRow] = useState<LedgerRow | null>(null);
  const [search, setSearch] = useState("");

  function load() {
    setLoading(true);
    fetch("/api/admin/ledger")
      .then((r) => r.json())
      .then((d) => setRows(d.rows ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      [row.registrationId, row.churchName, row.paymentStatus, row.category]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(q))
    );
  }, [rows, search]);

  const isOverdue = (row: LedgerRow) =>
    row.paymentType === "partial" &&
    row.remainingBalance > 0 &&
    row.installmentDeadline &&
    new Date(row.installmentDeadline) < new Date();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
          <Wallet className="h-5 w-5" /> Finance Ledger
        </h2>
        <p className="text-sm text-muted-foreground">
          Live balance per registration — Total Fee, Amount Paid, and Remaining Balance.
        </p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by registration, church, or status..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8"
        />
      </div>

      {loading ? (
        <div className="p-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
      ) : (
        <div className="rounded-lg border border-border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Registration</TableHead>
                <TableHead>Church</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead className="text-right">Total Fee</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Remaining</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                    No matching entries.
                  </TableCell>
                </TableRow>
              )}
              {filteredRows.map((row, idx) => (
                <TableRow key={row.id} className={idx % 2 === 1 ? "bg-muted/20" : ""}>
                  <TableCell className="font-mono text-sm">{row.registrationId}</TableCell>
                  <TableCell>{row.churchName ?? "—"}</TableCell>
                  <TableCell>
                    <span className="text-sm">
                      {row.paymentType === "partial" ? `Partial (${row.installmentCount ?? "?"})` : "Full"}
                    </span>
                    {isOverdue(row) && (
                      <Badge variant="destructive" className="ml-2">Overdue</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">${row.totalFee.toLocaleString()}</TableCell>
                  <TableCell className="text-right">${row.amountPaid.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-semibold">${row.remainingBalance.toLocaleString()}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" onClick={() => setActiveRow(row)}>Log Payment</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {activeRow && (
        <LogPaymentDialog
          registrationId={activeRow.id}
          registrationLabel={activeRow.registrationId}
          fee={activeRow.totalFee}
          open={!!activeRow}
          onOpenChange={(open) => !open && setActiveRow(null)}
          onLogged={load}
        />
      )}
    </div>
  );
}
