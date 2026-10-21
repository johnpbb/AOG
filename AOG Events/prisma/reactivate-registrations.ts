// Bulk-reactivates cancelled registrations by their reference IDs (e.g. after
// the 10-business-day auto-expiry).
//
// DRY RUN BY DEFAULT: the whole batch runs inside one transaction that is
// rolled back, so cap and venue-seat checks see the cumulative effect of every
// registration in the list (two duplicates can't both fit) but nothing is
// saved. Pass --apply to commit.
//
//   npx tsx prisma/reactivate-registrations.ts ids.txt            # dry run
//   npx tsx prisma/reactivate-registrations.ts ids.txt --apply    # for real
//
// ids.txt: one registration reference (AG100-...) per line; '#' starts a comment.
// Each registration runs in its own savepoint, so one that fails (cap reached,
// seats gone) is skipped and reported while the rest proceed.
import "dotenv/config";
import { readFileSync } from "fs";
import { prisma } from "../lib/prisma";
import { reactivateRegistration } from "../lib/reactivate-registration";

class DryRunRollback extends Error {}

async function main() {
  const file = process.argv[2];
  const apply = process.argv.includes("--apply");
  if (!file) {
    console.error("Usage: npx tsx prisma/reactivate-registrations.ts <ids.txt> [--apply]");
    process.exit(1);
  }

  const refs = readFileSync(file, "utf8")
    .split("\n")
    .map((l) => l.replace(/#.*/, "").trim())
    .filter(Boolean);

  console.log(`${apply ? "APPLYING" : "DRY RUN (nothing will be saved)"} — ${refs.length} registration(s)\n`);

  const ok: string[] = [];
  const failed: { ref: string; reason: string }[] = [];

  try {
    await prisma.$transaction(
      async (tx) => {
        for (const ref of refs) {
          const reg = await tx.registration.findUnique({ where: { registrationId: ref }, select: { id: true } });
          if (!reg) {
            failed.push({ ref, reason: "not found" });
            continue;
          }
          await tx.$executeRawUnsafe("SAVEPOINT reactivate_one");
          try {
            await reactivateRegistration(tx, reg.id);
            await tx.$executeRawUnsafe("RELEASE SAVEPOINT reactivate_one");
            ok.push(ref);
          } catch (err: any) {
            await tx.$executeRawUnsafe("ROLLBACK TO SAVEPOINT reactivate_one");
            failed.push({ ref, reason: err.message });
          }
        }
        if (!apply) throw new DryRunRollback();
      },
      { timeout: 120_000 }
    );
  } catch (err) {
    if (!(err instanceof DryRunRollback)) throw err;
  }

  console.log(`${apply ? "Reactivated" : "Would reactivate"} (${ok.length}):`);
  ok.forEach((r) => console.log(`  ✓ ${r}`));
  console.log(`\nSkipped (${failed.length}):`);
  failed.forEach((f) => console.log(`  ✗ ${f.ref} — ${f.reason}`));
  if (!apply) console.log("\nDry run only. Re-run with --apply to save.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
