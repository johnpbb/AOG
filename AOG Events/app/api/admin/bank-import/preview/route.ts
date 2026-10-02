import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { parseStatement, matchLines, BANK_MARKER_RE } from "@/lib/bank-statement";

const MAX_BYTES = 5 * 1024 * 1024;

// POST /api/admin/bank-import/preview — parse an uploaded bank statement and
// match each credit to a registration. Read-only: nothing is recorded until
// the admin confirms.
export async function POST(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser || (currentUser.role !== "SUPER_ADMIN" && currentUser.role !== "FINANCE")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Choose a statement file to upload" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File is too large (5MB max)" }, { status: 400 });
  }

  const opt = (k: string) => (form.get(k) ? String(form.get(k)) : undefined);
  let parsed;
  try {
    parsed = parseStatement(await file.arrayBuffer(), {
      date: opt("dateColumn"),
      credit: opt("creditColumn"),
      debit: opt("debitColumn"),
    });
  } catch {
    return NextResponse.json({ error: "Couldn't read that file. Upload a CSV or Excel export." }, { status: 400 });
  }

  if (parsed.headers.length === 0 || !parsed.columns.credit) {
    return NextResponse.json({
      error: "Couldn't find a Credit or Amount column. Pick the right column below.",
      headers: parsed.headers,
      columns: parsed.columns,
      lines: [],
    }, { status: 422 });
  }

  const [registrations, bankPayments] = await Promise.all([
    prisma.registration.findMany({
      where: { paymentStatus: { not: "CANCELLED" } },
      select: {
        id: true, registrationId: true, fee: true, paymentStatus: true, paymentType: true,
        registrarName: true, email: true,
        church: { select: { name: true } },
        payments: { select: { amount: true, status: true } },
      },
    }),
    prisma.payment.findMany({
      where: { referenceNote: { contains: "[BANK:" } },
      select: { referenceNote: true },
    }),
  ]);

  const alreadyImported = new Set<string>();
  for (const p of bankPayments) {
    for (const m of (p.referenceNote ?? "").matchAll(BANK_MARKER_RE)) alreadyImported.add(m[1]);
  }

  const lines = matchLines(
    parsed.lines,
    registrations.map((r) => ({
      id: r.id,
      registrationId: r.registrationId,
      fee: r.fee,
      paid: r.payments.filter((p) => p.status === "CONFIRMED").reduce((s, p) => s + p.amount, 0),
      paymentStatus: r.paymentStatus,
      paymentType: r.paymentType,
      label: r.church?.name ?? r.registrarName ?? r.email,
    })),
    alreadyImported
  );

  return NextResponse.json({
    headers: parsed.headers,
    columns: parsed.columns,
    skippedDebits: parsed.skippedDebits,
    lines,
  });
}
