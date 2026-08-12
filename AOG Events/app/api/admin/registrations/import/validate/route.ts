import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validateCsvRow, CSV_HEADERS } from "@/lib/registration-csv-schema";
import { isExcelFilename, parseExcelBuffer } from "@/lib/parse-tabular";

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB — comfortably thousands of rows, CSV or Excel
const MAX_ROWS = 2000;

// POST /api/admin/registrations/import/validate — parses an uploaded CSV or
// Excel file and checks every row against the same rules the public form
// enforces, WITHOUT creating anything. The admin UI shows this as a review
// step; only rows with zero errors can be committed via
// /api/admin/registrations/import/commit.
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
      return NextResponse.json({ error: "File too large. Maximum size is 5 MB." }, { status: 400 });
    }
    if (!/\.(csv|xlsx|xls)$/i.test(file.name)) {
      return NextResponse.json({ error: "Unsupported file type. Please upload a .csv, .xlsx, or .xls file." }, { status: 400 });
    }

    let fields: string[];
    let data: Record<string, string>[];

    if (isExcelFilename(file.name)) {
      const buffer = await file.arrayBuffer();
      const parsed = parseExcelBuffer(buffer);
      fields = parsed.fields;
      data = parsed.data;
      if (fields.length === 0) {
        return NextResponse.json({ error: "Could not read the Excel file — make sure it has a header row and at least one data row." }, { status: 400 });
      }
    } else {
      const text = await file.text();
      const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
      if (parsed.errors.length > 0) {
        return NextResponse.json(
          { error: `Could not parse CSV: ${parsed.errors[0].message} (row ${parsed.errors[0].row ?? "?"})` },
          { status: 400 }
        );
      }
      fields = parsed.meta.fields ?? [];
      data = parsed.data;
    }

    const missingHeaders = CSV_HEADERS.filter((h) => !fields.includes(h));
    if (missingHeaders.length > 0) {
      return NextResponse.json(
        { error: `File is missing required column(s): ${missingHeaders.join(", ")}. Download the template to see the expected format.` },
        { status: 400 }
      );
    }

    if (data.length === 0) {
      return NextResponse.json({ error: "The file has no data rows." }, { status: 400 });
    }
    if (data.length > MAX_ROWS) {
      return NextResponse.json({ error: `Too many rows — this importer supports up to ${MAX_ROWS} at a time.` }, { status: 400 });
    }

    const churchIds = new Set(
      data.map((r) => (r["Church ID"] ?? "").trim()).filter(Boolean)
    );
    const knownChurches = churchIds.size > 0
      ? await prisma.church.findMany({ where: { id: { in: [...churchIds] } }, select: { id: true } })
      : [];
    const knownChurchIds = new Set(knownChurches.map((c) => c.id));

    const rows = data.map((raw, i) => validateCsvRow(raw, i + 1, eventId, knownChurchIds));
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
