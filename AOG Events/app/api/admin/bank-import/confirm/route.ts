import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { recordPayment, RecordPaymentError } from "@/lib/record-payment";
import { bankMarker } from "@/lib/bank-statement";

// Kept small: each fully-paid row renders and emails ticket PDFs, so the
// client sends the batch in chunks rather than one long request.
const MAX_ITEMS = 10;

interface ConfirmItem {
  registrationId: string; // primary key from the preview
  amount: number;
  fingerprint: string;
  date?: string;
  narration?: string;
}

// POST /api/admin/bank-import/confirm — record the payments the admin ticked.
// Each row goes through recordPayment, the same path as the Manual Override Box,
// so completion, tickets and emails behave identically.
export async function POST(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser || (currentUser.role !== "SUPER_ADMIN" && currentUser.role !== "FINANCE")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { items, method } = (await req.json()) as { items?: ConfirmItem[]; method?: string };
  const paymentMethod = method === "MPAISA" ? "MPAISA" : "BANK_TRANSFER";
  if (!Array.isArray(items) || items.length === 0 || items.length > MAX_ITEMS) {
    return NextResponse.json({ error: `Send between 1 and ${MAX_ITEMS} rows per request` }, { status: 400 });
  }

  const results: { fingerprint: string; ok: boolean; error?: string; registrationId?: string; fullyPaid?: boolean }[] = [];

  // Sequential on purpose: two rows for one registration must see each other's total.
  for (const item of items) {
    const amount = Number(item.amount);
    if (!item.registrationId || !/^[0-9a-f]{16}$/.test(item.fingerprint ?? "") || !(amount > 0)) {
      results.push({ fingerprint: item.fingerprint, ok: false, error: "Invalid row" });
      continue;
    }

    try {
      const marker = bankMarker(item.fingerprint);
      const duplicate = await prisma.payment.findFirst({ where: { referenceNote: { contains: marker } }, select: { id: true } });
      if (duplicate) {
        results.push({ fingerprint: item.fingerprint, ok: false, error: "Already imported" });
        continue;
      }

      const reg = await prisma.registration.findUnique({
        where: { id: item.registrationId },
        select: { registrationId: true, fee: true, paymentStatus: true, payments: { select: { amount: true, status: true } } },
      });
      if (!reg) {
        results.push({ fingerprint: item.fingerprint, ok: false, error: "Registration not found" });
        continue;
      }
      if (reg.paymentStatus === "COMPLETED") {
        results.push({ fingerprint: item.fingerprint, ok: false, registrationId: reg.registrationId, error: "Already fully paid" });
        continue;
      }

      const paid = reg.payments.filter((p) => p.status === "CONFIRMED").reduce((s, p) => s + p.amount, 0);
      const covers = amount + paid >= reg.fee - 0.005;
      const note = [paymentMethod === "MPAISA" ? "M-PAiSA import" : "Bank import", item.date, item.narration?.slice(0, 200)].filter(Boolean).join(" · ");

      const r = await recordPayment({
        registrationId: item.registrationId,
        amount,
        entryType: covers ? "FULL" : "INSTALLMENT",
        method: paymentMethod,
        referenceNote: `${note} ${marker}`,
        confirmedBy: { id: currentUser.id, name: currentUser.name },
      });
      results.push({ fingerprint: item.fingerprint, ok: true, registrationId: reg.registrationId, fullyPaid: r.fullyPaid });
    } catch (e: any) {
      const msg = e instanceof RecordPaymentError ? (e.code === "CANCELLED" ? "Registration is cancelled" : "Registration not found") : "Failed to record payment";
      if (!(e instanceof RecordPaymentError)) console.error("Bank import confirm error:", e);
      results.push({ fingerprint: item.fingerprint, ok: false, error: msg });
    }
  }

  return NextResponse.json({ results });
}
