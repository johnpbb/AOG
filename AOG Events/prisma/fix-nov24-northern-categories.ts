// One-off fix for the Northern Division category list Litea (AG Fiji) sent on
// 24 Nov 2026 ("Change of Category Northen Division"). Moves each existing
// registration below to its church's new size category, the same way
// fix-nov23-kasavu-small.ts did for Kasavu.
//
// For each registration: category -> new size, fee -> the new flat fee,
// reference AG100-{church}{code}{total} gets the new code. Headcount, venue
// allocations (venues go by age group, not church size), attendees, payments
// and existing tickets are untouched. If confirmed payments now cover the fee
// and it was still PENDING, it is set COMPLETED and tickets are issued as
// record-payment would (no email is sent). The old reference and the reason
// are logged in formData.amendments, like the admin amend tool.
//
// Not included, pending a decision:
//   - Niurua AOG (AG100-190MD37): 22 adults is over Small's 15-adult cap.
//   - Lutukina AOG (AG100-184MD39): a second, PENDING Medium registration next
//     to the already-Small AG100-184SM29; looks like a duplicate.
//
// DRY RUN BY DEFAULT (transaction rolled back). Pass --apply to save.
// --only=REF,REF limits it to some of the references below.
//   npx tsx prisma/fix-nov24-northern-categories.ts [--only=...] [--apply]
import "dotenv/config";
import { prisma } from "../lib/prisma";
import { REGISTRATION_CATEGORIES, computeRegistrationFee } from "../lib/types";
import { generateTicketsForRegistration } from "../lib/tickets";

const NOTE = "Client request 24/11: Northern Division category change list (advised by the Divisional Office).";

const CHANGES: { ref: string; church: string; from: string; to: string }[] = [
  { ref: "AG100-186MD9", church: "Batinivurewai AOG", from: "medium-church", to: "small-church" },
  { ref: "AG100-193MD4", church: "Penial AOG", from: "medium-church", to: "small-church" },
  { ref: "AG100-195MD23", church: "Nabouwalu AOG", from: "medium-church", to: "small-church" },
  { ref: "AG100-197MD3", church: "Wailevu East AOG", from: "medium-church", to: "small-church" },
  { ref: "AG100-202MD18", church: "Pathway AOG", from: "medium-church", to: "large-church" },
  { ref: "AG100-207LG20", church: "Batiri AOG", from: "large-church", to: "medium-church" },
];

class DryRunRollback extends Error {}

async function main() {
  const apply = process.argv.includes("--apply");
  const onlyArg = process.argv.find((a) => a.startsWith("--only="));
  const only = onlyArg ? onlyArg.slice("--only=".length).split(",").filter(Boolean) : null;
  const changes = only ? CHANGES.filter((c) => only.includes(c.ref)) : CHANGES;
  if (only && changes.length !== only.length) throw new Error(`Unknown ref in --only: ${only.join(",")}`);
  console.log(`${apply ? "APPLYING" : "DRY RUN (nothing will be saved)"}: ${changes.length} registration(s)\n`);

  try {
    await prisma.$transaction(async (tx) => {
      for (const c of changes) {
        const reg = await tx.registration.findUnique({
          where: { registrationId: c.ref },
          include: { payments: true, tickets: { select: { status: true } } },
        });
        if (!reg) throw new Error(`${c.ref} not found`);
        if (reg.category !== c.from) throw new Error(`${c.ref} is ${reg.category}, not ${c.from}`);
        if (reg.paymentStatus === "CANCELLED") throw new Error(`${c.ref} is CANCELLED`);

        const cat = REGISTRATION_CATEGORIES.find((x) => x.id === c.to)!;
        const caps = cat.perRegCap!;
        if (reg.adults > caps.adults || reg.youth > caps.youth || reg.kids > caps.kids) {
          throw new Error(`${c.ref} (${reg.adults}/${reg.youth}/${reg.kids}) is over ${cat.name} caps ${caps.adults}/${caps.youth}/${caps.kids}`);
        }
        const total = reg.adults + reg.youth + reg.kids;
        const fee = computeRegistrationFee(cat, { isChurchPath: true, headcount: total });
        const newRef = `AG100-${reg.churchId}${cat.categoryCode}${total}`;
        if (await tx.registration.findUnique({ where: { registrationId: newRef } })) {
          throw new Error(`${newRef} already exists`);
        }
        const confirmed = reg.payments.filter((p) => p.status === "CONFIRMED").reduce((s, p) => s + p.amount, 0);
        if (reg.paymentStatus === "COMPLETED" && confirmed < fee) {
          throw new Error(`${c.ref} is COMPLETED but paid ${confirmed} < new fee ${fee}; handle by hand`);
        }

        const formData = (reg.formData ?? {}) as Record<string, any>;
        const amendments = Array.isArray(formData.amendments) ? formData.amendments : [];
        amendments.push({
          at: new Date().toISOString(),
          by: "System (client request script)",
          byId: null,
          from: { adults: reg.adults, youth: reg.youth, kids: reg.kids, fee: reg.fee },
          to: { adults: reg.adults, youth: reg.youth, kids: reg.kids, fee },
          categoryChange: { from: reg.category, to: cat.id, oldRegistrationId: reg.registrationId, newRegistrationId: newRef },
          ticketsAdded: 0,
          ticketsCancelled: 0,
          attendeesReplaced: false,
          note: NOTE,
          capOverride: false,
        });

        await tx.registration.update({
          where: { id: reg.id },
          data: { category: cat.id, fee, registrationId: newRef, formData: { ...formData, amendments } },
        });
        // Same as lib/record-payment.ts when a payment clears the balance.
        let ticketCount = 0;
        let status = reg.paymentStatus;
        if (confirmed > 0 && confirmed >= fee && reg.paymentStatus !== "COMPLETED") {
          await tx.registration.update({ where: { id: reg.id }, data: { paymentStatus: "COMPLETED" } });
          status = "COMPLETED";
          if (reg.tickets.length === 0) {
            const attendees = await tx.attendee.findMany({ where: { registrationId: reg.id }, select: { id: true, ageCategory: true } });
            const tickets = await generateTicketsForRegistration(tx, reg.id, reg.adults, reg.youth, attendees as any);
            ticketCount = tickets.length;
          }
        }
        const bal = fee - confirmed;
        console.log(
          `${c.church.padEnd(18)} ${c.ref} -> ${newRef}  fee ${reg.fee} -> ${fee}  paid ${confirmed}  ` +
            `${bal > 0 ? `owes ${bal}` : bal < 0 ? `OVERPAID ${-bal}` : "paid in full"}  ` +
            `status ${reg.paymentStatus} -> ${status}  tickets ${reg.tickets.length} existing, ${ticketCount} issued`
        );
      }
      if (!apply) throw new DryRunRollback();
    });
  } catch (err) {
    if (!(err instanceof DryRunRollback)) throw err;
    console.log("\nDry run only. Re-run with --apply to save.");
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
