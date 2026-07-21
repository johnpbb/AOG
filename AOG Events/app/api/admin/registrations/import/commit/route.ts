import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createRegistrationRecord, RegistrationCapacityError, type CreateRegistrationInput } from "@/lib/create-registration";

// POST /api/admin/registrations/import/commit — creates one Registration per
// row the admin confirmed on the review screen. Each row runs in its own
// transaction (not one big transaction for the whole file) so a single row
// failing — e.g. a pool filled up by an earlier row in the same batch —
// doesn't roll back rows that already succeeded. Rows are still processed
// sequentially (not in parallel) so pool-capacity checks stay accurate
// within the batch.
export async function POST(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { rows } = (await req.json()) as { rows: { rowNumber: number; input: CreateRegistrationInput }[] };

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: "No rows to import." }, { status: 400 });
    }

    const results: { rowNumber: number; success: boolean; registrationId?: string; error?: string }[] = [];

    for (const row of rows) {
      try {
        const result = await prisma.$transaction((tx) => createRegistrationRecord(tx, row.input));
        results.push({ rowNumber: row.rowNumber, success: true, registrationId: result.registration.registrationId });
      } catch (error: any) {
        results.push({
          rowNumber: row.rowNumber,
          success: false,
          error: error instanceof RegistrationCapacityError ? error.message : "Could not create this registration.",
        });
      }
    }

    const succeeded = results.filter((r) => r.success).length;
    return NextResponse.json({
      succeeded,
      failed: results.length - succeeded,
      results,
    });
  } catch (error) {
    console.error("CSV commit error:", error);
    return NextResponse.json({ error: "Import failed. Please try again." }, { status: 500 });
  }
}
