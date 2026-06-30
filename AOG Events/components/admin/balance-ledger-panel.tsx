"use client";

import { useEffect, useState } from "react";
import { Loader2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

  function load() {
    setLoading(true);
    fetch("/api/admin/ledger")
      .then((r) => r.json())
      .then((d) => setRows(d.rows ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

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
              {rows.map((row, idx) => (
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
