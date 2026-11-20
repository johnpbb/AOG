// One-off fix for the client's 20 Nov 2026 request: Bethel Community Church
// (351) is downgraded from Large to Medium, and its existing registration
// moves with it, keeping its 96 attendees with an approved cap override
// (35 kids against Medium's limit of 30).
//
// Changes category -> medium-church, fee -> the Medium flat fee, and the
// reference number LG -> MD so it still follows AG100-{church}{code}{total}.
// Headcount, venue seats, attendees and payments are untouched. Bethel had
// already paid 3,000, which now covers the fee, so it is set COMPLETED and
// tickets are issued as record-payment would (no ticket email is sent).
// The old reference and the reason are logged in formData.amendments, the
// same trail the admin amend tool writes to. No emails are sent.
//
// DRY RUN BY DEFAULT (transaction rolled back). Pass --apply to save.
//   npx tsx prisma/fix-nov20-bethel-medium.ts [--apply]
import "dotenv/config";
import { prisma } from "../lib/prisma";
import { REGISTRATION_CATEGORIES, computeRegistrationFee } from "../lib/types";
import { generateTicketsForRegistration } from "../lib/tickets";

const REF = "AG100-351LG96";
const NOTE = "Client request 20/11: Bethel Community downgraded Large -> Medium (confirmed with Bro. Siti); approved override of Medium kids limit (35 > 30).";

class DryRunRollback extends Error {}

async function main() {
  const apply = process.argv.includes("--apply");
  console.log(`${apply ? "APPLYING" : "DRY RUN (nothing will be saved)"}\n`);

  try {
    await prisma.$transaction(async (tx) => {
      const reg = await tx.registration.findUnique({
        where: { registrationId: REF },
        include: { payments: true, tickets: { select: { status: true } } },
      });
      if (!reg) throw new Error(`${REF} not found`);
      if (reg.category !== "large-church") throw new Error(`${REF} is ${reg.category}, not large-church`);
      if (reg.paymentStatus === "CANCELLED") throw new Error(`${REF} is CANCELLED`);

      const medium = REGISTRATION_CATEGORIES.find((c) => c.id === "medium-church")!;
      const total = reg.adults + reg.youth + reg.kids;
      const fee = computeRegistrationFee(medium, { isChurchPath: true, headcount: total });
      const newRef = `AG100-${reg.churchId}${medium.categoryCode}${total}`;
      if (await tx.registration.findUnique({ where: { registrationId: newRef } })) {
        throw new Error(`${newRef} already exists`);
      }
      const confirmed = reg.payments.filter((p) => p.status === "CONFIRMED").reduce((s, p) => s + p.amount, 0);

      console.log(`BEFORE ${reg.registrationId}  ${reg.category}  fee=${reg.fee}  status=${reg.paymentStatus}`);
      console.log(`       adults=${reg.adults} youth=${reg.youth} kids=${reg.kids}  confirmed paid=${confirmed}`);
      console.log(`       tickets: ${reg.tickets.map((t) => t.status).join(", ") || "none"}`);

      const formData = (reg.formData ?? {}) as Record<string, any>;
      const amendments = Array.isArray(formData.amendments) ? formData.amendments : [];
      amendments.push({
        at: new Date().toISOString(),
        by: "System (client request script)",
        byId: null,
        from: { adults: reg.adults, youth: reg.youth, kids: reg.kids, fee: reg.fee },
        to: { adults: reg.adults, youth: reg.youth, kids: reg.kids, fee },
        categoryChange: { from: reg.category, to: medium.id, oldRegistrationId: reg.registrationId, newRegistrationId: newRef },
        ticketsAdded: 0,
        ticketsCancelled: 0,
        attendeesReplaced: false,
        note: NOTE,
        capOverride: true,
      });

      const paidInFull = confirmed > 0 && confirmed >= fee;
      const after = await tx.registration.update({
        where: { id: reg.id },
        data: {
          category: medium.id,
          fee,
          registrationId: newRef,
          formData: { ...formData, amendments },
        },
      });
      // Same as lib/record-payment.ts when a payment clears the balance:
      // flip to COMPLETED and issue entry tickets. No email is sent here.
      let ticketCount = 0;
      if (paidInFull && reg.paymentStatus !== "COMPLETED") {
        await tx.registration.update({ where: { id: reg.id }, data: { paymentStatus: "COMPLETED" } });
        if (reg.tickets.length === 0) {
          const attendees = await tx.attendee.findMany({ where: { registrationId: reg.id }, select: { id: true, ageCategory: true } });
          const tickets = await generateTicketsForRegistration(tx, reg.id, reg.adults, reg.youth, attendees as any);
          ticketCount = tickets.length;
        }
      }
      const final = await tx.registration.findUnique({ where: { id: reg.id }, select: { paymentStatus: true } });
      console.log(`AFTER  ${after.registrationId}  ${after.category}  fee=${after.fee}  status=${final?.paymentStatus}  tickets issued=${ticketCount}`);
      if (confirmed > fee) console.log(`NOTE: overpaid by ${confirmed - fee} at the new fee.`);

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
