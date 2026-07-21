import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validateCsvRow, CSV_HEADERS } from "@/lib/registration-csv-schema";

const MAX_SIZE = 2 * 1024 * 1024; // 2 MB — comfortably thousands of rows
const MAX_ROWS = 2000;

// POST /api/admin/registrations/import/validate — parses an uploaded CSV and
// checks every row against the same rules the public form enforces, WITHOUT
// creating anything. The admin UI shows this as a review step; only rows
// with zero errors can be committed via /api/admin/registrations/import/commit.
export async function POST(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const eventId = formData.get("eventId") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (!eventId) {
      return NextResponse.json({ error: "eventId is required" }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "File too large. Maximum size is 2 MB." }, { status: 400 });
    }

    const text = await file.text();
    const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });

    if (parsed.errors.length > 0) {
      return NextResponse.json(
        { error: `Could not parse CSV: ${parsed.errors[0].message} (row ${parsed.errors[0].row ?? "?"})` },
        { status: 400 }
      );
    }

    const missingHeaders = CSV_HEADERS.filter((h) => !parsed.meta.fields?.includes(h));
    if (missingHeaders.length > 0) {
      return NextResponse.json(
        { error: `CSV is missing required column(s): ${missingHeaders.join(", ")}. Download the template to see the expected format.` },
        { status: 400 }
      );
    }

    if (parsed.data.length === 0) {
      return NextResponse.json({ error: "The CSV has no data rows." }, { status: 400 });
    }
    if (parsed.data.length > MAX_ROWS) {
      return NextResponse.json({ error: `Too many rows — this importer supports up to ${MAX_ROWS} at a time.` }, { status: 400 });
    }

    const churchIds = new Set(
      parsed.data.map((r) => (r["Church ID"] ?? "").trim()).filter(Boolean)
    );
    const knownChurches = churchIds.size > 0
      ? await prisma.church.findMany({ where: { id: { in: [...churchIds] } }, select: { id: true } })
      : [];
    const knownChurchIds = new Set(knownChurches.map((c) => c.id));

    const rows = parsed.data.map((raw, i) => validateCsvRow(raw, i + 1, eventId, knownChurchIds));
    const validCount = rows.filter((r) => r.errors.length === 0).length;

    return NextResponse.json({
      totalRows: rows.length,
      validCount,
      invalidCount: rows.length - validCount,
      rows,
    });
  } catch (error) {
    console.error("CSV validate error:", error);
    return NextResponse.json({ error: "Could not process the file. Please try again." }, { status: 500 });
  }
}
