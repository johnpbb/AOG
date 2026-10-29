// One-off fix for the client's 28/29 Oct 2026 "List for platform updates":
//   1. Delete the "TEST DELETE" Individual test registrations.
//   2. Apply seven headcount changes (items 3-9) via the admin amend logic,
//      with the category-cap override for the four over-limit churches.
//
// Church name/category fixes (items 10-11) live in prisma/data/aog-fiji-churches.csv;
// apply them with `npx tsx prisma/seed-churches.ts` (it upserts by church id).
//
// DRY RUN BY DEFAULT: everything runs in one transaction that is rolled back
// and the before/after state is printed. Pass --apply to save.
//
//   npx tsx prisma/fix-oct29-requests.ts            # dry run
//   npx tsx prisma/fix-oct29-requests.ts --apply    # for real
//
// No emails are sent. Existing ticket numbers and QR codes are kept; only the
// delta is created or cancelled (see lib/amend-registration.ts).
import "dotenv/config";
import { prisma } from "../lib/prisma";
import { amendRegistration } from "../lib/amend-registration";
import { cancelRegistration } from "../lib/cancel-registration";

type Change = { ref: string; adults: number; youth: number; kids: number; override: boolean; note: string };

const CHANGES: Change[] = [
  { ref: "AG100-143VL275", adults: 140, youth: 65, kids: 54, override: false, note: "Client change request 28/10: 275 -> 259." },
  { ref: "AG100-129LG69", adults: 34, youth: 26, kids: 15, override: false, note: "Client change request 28/10: 69 -> 75." },
  { ref: "AG100-362VL1592", adults: 250, youth: 200, kids: 100, override: false, note: "Client change request 28/10: 1592 -> 550." },
  { ref: "AG100-260SM50", adults: 22, youth: 16, kids: 20, override: true, note: "Original manual listing exceeded Small limits; approved override, client list 28/10." },
  { ref: "AG100-326MD60", adults: 37, youth: 13, kids: 30, override: true, note: "Original manual listing exceeded Medium limits; approved override, client list 29/10." },
  { ref: "AG100-290MD88", adults: 32, youth: 27, kids: 31, override: true, note: "Original manual listing exceeded Medium limits; approved override, client list 29/10." },
  { ref: "AG100-422SM42", adults: 23, youth: 12, kids: 15, override: true, note: "Original manual listing exceeded Small limits; approved override, client list 29/10." },
];

class DryRunRollback extends Error {}
const money = (n: number) => n.toFixed(2);

async function describe(tx: any, ref: string) {
  const r = await tx.registration.findUnique({
    where: { registrationId: ref },
    include: {
      payments: { select: { amount: true, status: true } },
      tickets: { select: { status: true } },
      church: { select: { name: true } },
    },
  });
  if (!r) return console.log(`  ${ref}: NOT FOUND`);
  const paid = r.payments.filter((p: any) => p.status === "CONFIRMED").reduce((s: number, p: any) => s + p.amount, 0);
  const active = r.tickets.filter((t: any) => t.status === "ACTIVE").length;
  console.log(
    `  ${ref} ${r.church?.name ?? ""}: ${r.paymentStatus}, A${r.adults}/Y${r.youth}/K${r.kids}, fee=${money(r.fee)}, paid=${money(paid)}, active tickets=${active}`
  );
}

async function findTestEntries(tx: any) {
  const upper = (s: string) => s.toUpperCase();
  const candidates = await tx.registration.findMany({
    where: { type: "INDIVIDUAL" },
    include: {
      attendees: { select: { firstName: true, lastName: true } },
      payments: { select: { amount: true, status: true } },
    },
  });
  return candidates.filter((r: any) => {
    const fd = (r.formData ?? {}) as Record<string, unknown>;
    const names = [
      `${fd.firstName ?? ""} ${fd.lastName ?? ""}`,
      r.registrarName ?? "",
      ...r.attendees.map((a: any) => `${a.firstName} ${a.lastName}`),
    ].map((n) => upper(String(n)));
    return names.some((n) => n.includes("TEST DELETE"));
  });
}

async function main() {
  const apply = process.argv.includes("--apply");
  console.log(`${apply ? "APPLYING" : "DRY RUN (nothing will be saved)"}\n`);

  const ok: string[] = [];
  const failed: { what: string; reason: string }[] = [];

  try {
    await prisma.$transaction(
      async (tx) => {
        console.log("BEFORE");
        for (const c of CHANGES) await describe(tx, c.ref);

        const tests = await findTestEntries(tx);
        console.log(`\n  Test entries found: ${tests.length}`);
        for (const t of tests) console.log(`    ${t.registrationId}  ${t.paymentStatus}  ${t.email}`);

        const tasks: [string, () => Promise<void>][] = [
          ...CHANGES.map((c): [string, () => Promise<void>] => [
            `amend ${c.ref}`,
            async () => {
              const reg = await tx.registration.findUnique({ where: { registrationId: c.ref }, select: { id: true } });
              if (!reg) throw new Error("not found");
              await amendRegistration(
                tx,
                reg.id,
                { adults: c.adults, youth: c.youth, kids: c.kids, note: c.note, overrideCaps: c.override },
                { id: "script", name: "Support script (client list 28-29 Oct)" }
              );
            },
          ]),
          ...tests.map((t: any): [string, () => Promise<void>] => [
            `delete test entry ${t.registrationId}`,
            async () => {
              if (t.payments.some((p: any) => p.status === "CONFIRMED")) throw new Error("has confirmed payments, not deleting");
              if (t.paymentStatus !== "CANCELLED") await cancelRegistration(tx, t.id); // returns seats to the pool
              await tx.registration.delete({ where: { id: t.id } }); // children cascade
            },
          ]),
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
        for (const c of CHANGES) await describe(tx, c.ref);

        if (!apply) throw new DryRunRollback();
      },
      { timeout: 180_000 }
    );
  } catch (err) {
    if (!(err instanceof DryRunRollback)) throw err;
  }

  console.log(`\n${apply ? "Done" : "Would do"} (${ok.length}):`);
  ok.forEach((o) => console.log(`  ✓ ${o}`));
  console.log(`\nSkipped (${failed.length}):`);
  failed.forEach((f) => console.log(`  ✗ ${f.what} — ${f.reason}`));
  if (!apply) console.log("\nDry run only. Re-run with --apply to save.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
