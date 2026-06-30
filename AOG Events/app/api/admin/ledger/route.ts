import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// GET /api/admin/ledger — Live Balance Ledger: Total Fee | Amount Paid | Remaining
// Per-registration is the source of truth; ?groupBy=church rolls it up per church.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const groupByChurch = searchParams.get("groupBy") === "church";

  const registrations = await prisma.registration.findMany({
    where: { paymentStatus: { not: "CANCELLED" } },
    include: {
      payments: { select: { amount: true, status: true } },
      church: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const rows = registrations.map((r) => {
    const amountPaid = r.payments
      .filter((p) => p.status === "CONFIRMED")
      .reduce((sum, p) => sum + p.amount, 0);
    return {
      id: r.id,
      registrationId: r.registrationId,
      churchId: r.churchId,
      churchName: r.church?.name ?? null,
      category: r.category,
      totalFee: r.fee,
      amountPaid,
      remainingBalance: Math.max(0, r.fee - amountPaid),
      paymentType: r.paymentType,
      installmentCount: r.installmentCount,
      installmentDeadline: r.installmentDeadline,
      paymentStatus: r.paymentStatus,
    };
  });

  if (!groupByChurch) {
    return NextResponse.json({ rows });
  }

  const byChurch = new Map<string, { churchId: string | null; churchName: string | null; totalFee: number; amountPaid: number; remainingBalance: number; registrations: number }>();
  for (const row of rows) {
    const key = row.churchId ?? "none";
    const existing = byChurch.get(key) ?? {
      churchId: row.churchId,
      churchName: row.churchName,
      totalFee: 0,
      amountPaid: 0,
      remainingBalance: 0,
      registrations: 0,
    };
    existing.totalFee += row.totalFee;
    existing.amountPaid += row.amountPaid;
    existing.remainingBalance += row.remainingBalance;
    existing.registrations += 1;
    byChurch.set(key, existing);
  }

  return NextResponse.json({ rows: Array.from(byChurch.values()) });
}
