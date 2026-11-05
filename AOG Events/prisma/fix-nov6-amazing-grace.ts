// Client request 6 Nov 2026: Amazing Grace C.C (Central) gets +23 adults,
// +7 youth, +5 kids (32/24/15 -> 55/31/20), via the admin amend logic.
//
// Two Central churches are named "AMAZING GRACE AOG" (058 Hindi, 129 Nasinu),
// so run without --ref first to list their registrations, then pass the right one.
//
//   npx tsx prisma/fix-nov6-amazing-grace.ts                      # list candidates
//   npx tsx prisma/fix-nov6-amazing-grace.ts --ref=AG100-...     # dry run
//   npx tsx prisma/fix-nov6-amazing-grace.ts --ref=AG100-... --apply
import "dotenv/config";
import { prisma } from "../lib/prisma";
import { amendRegistration } from "../lib/amend-registration";

const ADD = { adults: 23, youth: 7, kids: 5 };
const EXPECT = { adults: 32, youth: 24, kids: 15 };

class DryRunRollback extends Error {}

async function main() {
  const ref = process.argv.find((a) => a.startsWith("--ref="))?.slice(6);
  const apply = process.argv.includes("--apply");

  if (!ref) {
    const regs = await prisma.registration.findMany({
      where: { church: { name: { contains: "AMAZING GRACE", mode: "insensitive" } } },
      include: { church: { select: { name: true, district: true } } },
    });
    for (const r of regs)
      console.log(`${r.registrationId}  ${r.church?.name} (${r.church?.district})  ${r.paymentStatus}  A${r.adults}/Y${r.youth}/K${r.kids}`);
    return;
  }

  try {
    await prisma.$transaction(async (tx) => {
      const r = await tx.registration.findUnique({ where: { registrationId: ref } });
      if (!r) throw new Error("registration not found");
      if (r.adults !== EXPECT.adults || r.youth !== EXPECT.youth || r.kids !== EXPECT.kids)
        throw new Error(`current A${r.adults}/Y${r.youth}/K${r.kids} is not the expected 32/24/15; check the right registration`);
      console.log(`BEFORE A${r.adults}/Y${r.youth}/K${r.kids} fee=${r.fee}`);
      await amendRegistration(
        tx,
        r.id,
        { adults: r.adults + ADD.adults, youth: r.youth + ADD.youth, kids: r.kids + ADD.kids, note: "Client change request 6/11: +23 adults, +7 youth, +5 kids.", overrideCaps: false },
        { id: "script", name: "Support script (client request 6 Nov)" }
      );
      const a = await tx.registration.findUnique({ where: { id: r.id } });
      console.log(`AFTER  A${a!.adults}/Y${a!.youth}/K${a!.kids} fee=${a!.fee}, ${a!.paymentStatus}`);
      if (!apply) throw new DryRunRollback();
    });
  } catch (e) {
    if (!(e instanceof DryRunRollback)) throw e;
    console.log("Dry run only. Re-run with --apply to save.");
  }
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
