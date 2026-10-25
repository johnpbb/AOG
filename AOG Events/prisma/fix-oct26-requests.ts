// One-off fix for the finance team's 26 Oct 2026 request:
//   1. Reactivate two PAID registrations that were cancelled.
//   2. Void the second (duplicate) payment on two registrations.
//
// DRY RUN BY DEFAULT: everything runs in one transaction that is rolled back,
// and the current/after state of each record is printed. Pass --apply to save.
//
//   npx tsx prisma/fix-oct26-requests.ts            # dry run
//   npx tsx prisma/fix-oct26-requests.ts --apply    # for real
//
// Why this isn't prisma/reactivate-registrations.ts: that script (rightly)
// refuses registrations that carry payments or tickets and only sets PENDING.
// Here the money is already in, so the registration goes back to COMPLETED
// (when confirmed payments cover the fee), its cancelled tickets are made
// ACTIVE again, and venue seats are re-claimed with the usual cap checks.
// No emails are sent.
//
// Duplicate payments are voided (status REJECTED, note appended), never
// deleted, so the audit trail stays intact. The ledger and balance maths only
// count CONFIRMED payments.
import "dotenv/config";
import { prisma } from "../lib/prisma";
import { PaymentStatus, TicketStatus } from "@prisma/client";
import { REGISTRATION_CATEGORIES } from "../lib/types";
import { autoAssignVenues, applyVenueAllocations } from "../lib/venue-assignment";
import { checkCategoryCapacity } from "../lib/create-registration";
import { generateTicketsForRegistration } from "../lib/tickets";

const REACTIVATE = ["AG100-000OS1-12", "AG100-000OS1-13"];
const VOID_DUPLICATE = ["AG100-101MD36", "AG100-000OS2-7"];

class DryRunRollback extends Error {}

const money = (n: number) => n.toFixed(2);

async function describe(tx: any, ref: string, label: string) {
  const r = await tx.registration.findUnique({
    where: { registrationId: ref },
    include: {
      payments: { orderBy: { confirmedAt: "asc" }, include: { confirmedBy: { select: { name: true } } } },
      tickets: { select: { id: true, status: true } },
      venueAllocations: { include: { venue: { select: { name: true } } } },
      church: { select: { name: true } },
    },
  });
  if (!r) {
    console.log(`  [${label}] ${ref}: NOT FOUND`);
    return;
  }
  const confirmed = r.payments.filter((p: any) => p.status === "CONFIRMED").reduce((s: number, p: any) => s + p.amount, 0);
  console.log(`  [${label}] ${ref}  ${r.church?.name ?? r.registrarName ?? r.email}`);
  console.log(`      status=${r.paymentStatus}  category=${r.category}  fee=${money(r.fee)}  confirmed paid=${money(confirmed)}`);
  console.log(`      headcount: adults=${r.adults} youth=${r.youth} kids=${r.kids}`);
  console.log(`      tickets: ${r.tickets.map((t: any) => t.status).join(", ") || "none"}`);
  console.log(
    `      venues: ${r.venueAllocations.map((a: any) => `${a.venue.name} x${a.count}`).join(", ") || "none"}${r.venueId ? "  (legacy venueId set)" : ""}`
  );
  for (const p of r.payments) {
    console.log(
      `      payment ${p.id}  ${money(p.amount)}  ${p.status}  ${p.method}  ${p.confirmedAt.toISOString()}  by ${p.confirmedBy?.name ?? "?"}  note="${p.referenceNote ?? ""}"`
    );
  }
}

async function reactivatePaid(tx: any, ref: string, notes: string[]) {
  const reg = await tx.registration.findUnique({
    where: { registrationId: ref },
    include: { payments: true, tickets: true, attendees: { select: { id: true, ageCategory: true } } },
  });
  if (!reg) throw new Error("not found");
  if (reg.paymentStatus !== PaymentStatus.CANCELLED) throw new Error(`is ${reg.paymentStatus}, not CANCELLED`);

  const confirmed = reg.payments
    .filter((p: any) => p.status === "CONFIRMED")
    .reduce((s: number, p: any) => s + p.amount, 0);
  if (confirmed <= 0) throw new Error("has no confirmed payments (use reactivate-registrations.ts instead)");
  const fullyPaid = confirmed >= reg.fee;

  const catInfo = REGISTRATION_CATEGORIES.find((c) => c.id === reg.category);
  if (!catInfo) throw new Error(`unknown category "${reg.category}"`);
  const counts = { adults: reg.adults, youth: reg.youth, kids: reg.kids };

  // Cancelling returned the seats to the pool; re-claim them without
  // overselling (throws, and this registration is skipped, if full).
  await checkCategoryCapacity(tx, catInfo, counts, reg.id);
  const { allocations, warnings } = await autoAssignVenues(tx, reg.eventId, counts);
  if (warnings.length > 0) throw new Error(warnings.join(" "));
  await applyVenueAllocations(tx, reg.id, allocations);

  await tx.registration.update({
    where: { id: reg.id },
    data: {
      paymentStatus: fullyPaid ? PaymentStatus.COMPLETED : PaymentStatus.PENDING,
      reactivatedAt: new Date(),
      expiryReminderSentAt: null,
    },
  });

  if (!fullyPaid) {
    notes.push(`${ref}: confirmed ${money(confirmed)} < fee ${money(reg.fee)}, so set to PENDING (not COMPLETED).`);
    return;
  }

  const cancelledTickets = reg.tickets.filter((t: any) => t.status === TicketStatus.CANCELLED);
  if (reg.tickets.length === 0) {
    await generateTicketsForRegistration(tx, reg.id, reg.adults, reg.youth, reg.attendees);
    notes.push(`${ref}: had no tickets, generated new ones.`);
  } else if (cancelledTickets.length > 0) {
    await tx.ticket.updateMany({
      where: { registrationId: reg.id, status: TicketStatus.CANCELLED },
      data: { status: TicketStatus.ACTIVE },
    });
    notes.push(`${ref}: re-activated ${cancelledTickets.length} cancelled ticket(s) (same QR codes as before).`);
  }
}

async function voidDuplicate(tx: any, ref: string, notes: string[]) {
  const reg = await tx.registration.findUnique({
    where: { registrationId: ref },
    include: { payments: { orderBy: { confirmedAt: "asc" } } },
  });
  if (!reg) throw new Error("not found");

  const confirmed = reg.payments.filter((p: any) => p.status === "CONFIRMED");
  // Only act on the unambiguous pattern: exactly two confirmed payments for
  // the same amount. Anything else needs a human to look at it.
  if (confirmed.length !== 2 || confirmed[0].amount !== confirmed[1].amount) {
    throw new Error(
      `expected exactly 2 confirmed payments of equal amount, found ${confirmed.length} (${confirmed.map((p: any) => money(p.amount)).join(", ")}). Not touching it.`
    );
  }
  const dup = confirmed[1]; // the later one
  await tx.payment.update({
    where: { id: dup.id },
    data: {
      status: "REJECTED",
      referenceNote: `${dup.referenceNote ? dup.referenceNote + " " : ""}[VOIDED duplicate entry, finance request 2026-10-26]`,
    },
  });

  const remaining = confirmed[0].amount;
  if (reg.paymentStatus === PaymentStatus.COMPLETED && remaining < reg.fee) {
    notes.push(
      `${ref}: WARNING — status is COMPLETED but confirmed payments are now ${money(remaining)} < fee ${money(reg.fee)}. ` +
        `The duplicate was covering the balance, so the registration may be genuinely underpaid. Status NOT changed; please check.`
    );
  }
}

async function main() {
  const apply = process.argv.includes("--apply");
  console.log(`${apply ? "APPLYING" : "DRY RUN (nothing will be saved)"}\n`);

  const ok: string[] = [];
  const failed: { what: string; reason: string }[] = [];
  const notes: string[] = [];

  try {
    await prisma.$transaction(
      async (tx) => {
        console.log("BEFORE");
        for (const ref of REACTIVATE) await describe(tx, ref, "reactivate");
        for (const ref of VOID_DUPLICATE) await describe(tx, ref, "void dup");

        // Each task runs in its own savepoint: one failing doesn't block the rest.
        const tasks: [string, () => Promise<void>][] = [
          ...REACTIVATE.map((ref): [string, () => Promise<void>] => [`reactivate ${ref}`, () => reactivatePaid(tx, ref, notes)]),
          ...VOID_DUPLICATE.map((ref): [string, () => Promise<void>] => [`void duplicate on ${ref}`, () => voidDuplicate(tx, ref, notes)]),
        ];
        for (const [what, run] of tasks) {
          await tx.$executeRawUnsafe("SAVEPOINT fix_one");
          try {
            await run();
            await tx.$executeRawUnsafe("RELEASE SAVEPOINT fix_one");
            ok.push(what);
          } catch (err: any) {
            await tx.$executeRawUnsafe("ROLLBACK TO SAVEPOINT fix_one");
            failed.push({ what, reason: err.message });
          }
        }

        console.log("\nAFTER (inside the transaction)");
        for (const ref of REACTIVATE) await describe(tx, ref, "reactivate");
        for (const ref of VOID_DUPLICATE) await describe(tx, ref, "void dup");

        if (!apply) throw new DryRunRollback();
      },
      { timeout: 120_000 }
    );
  } catch (err) {
    if (!(err instanceof DryRunRollback)) throw err;
  }

  console.log(`\n${apply ? "Done" : "Would do"} (${ok.length}):`);
  ok.forEach((o) => console.log(`  ✓ ${o}`));
  console.log(`\nSkipped (${failed.length}):`);
  failed.forEach((f) => console.log(`  ✗ ${f.what} — ${f.reason}`));
  if (notes.length) {
    console.log("\nNotes:");
    notes.forEach((n) => console.log(`  - ${n}`));
  }
  if (!apply) console.log("\nDry run only. Re-run with --apply to save.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
