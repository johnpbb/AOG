import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { recordPayment, RecordPaymentError } from "@/lib/record-payment";

// GET /api/admin/registrations/[id]/payments — the append-only audit trail
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const payments = await prisma.payment.findMany({
    where: { registrationId: id },
    include: { confirmedBy: { select: { name: true } } },
    orderBy: { confirmedAt: "asc" },
  });
  return NextResponse.json({ payments });
}

// POST /api/admin/registrations/[id]/payments — the Manual Override Box:
// Finance logs a payment receipt (full or installment). See recordPayment for
// the completion, ticket and email behaviour.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { amount, entryType, method, referenceNote, installmentNo } = await req.json();

  if (!amount || amount <= 0) {
    return NextResponse.json({ error: "A positive payment amount is required" }, { status: 400 });
  }

  try {
    const result = await recordPayment({
      registrationId: id,
      amount: parseFloat(String(amount)),
      entryType,
      method,
      referenceNote,
      installmentNo: installmentNo ? parseInt(String(installmentNo), 10) : null,
      confirmedBy: { id: currentUser.id, name: currentUser.name },
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    if (error instanceof RecordPaymentError && error.code === "NOT_FOUND") {
      return NextResponse.json({ error: "Registration not found" }, { status: 404 });
    }
    if (error instanceof RecordPaymentError && error.code === "CANCELLED") {
      return NextResponse.json({ error: "Cannot log a payment against a cancelled registration" }, { status: 409 });
    }
    console.error("Log payment error:", error);
    return NextResponse.json({ error: "Failed to log payment" }, { status: 500 });
  }
}
