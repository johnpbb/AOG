import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { toCSV, csvFileResponse } from "@/lib/csv";
import { CSV_HEADERS, CSV_TEMPLATE_EXAMPLE_ROWS } from "@/lib/registration-csv-schema";

// GET /api/admin/registrations/import/template — downloads a blank CSV
// template (with a couple of example rows) matching exactly what
// /api/admin/registrations/import/validate expects, so upload and download
// can't silently drift apart.
export async function GET() {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const csv = toCSV([[...CSV_HEADERS], ...CSV_TEMPLATE_EXAMPLE_ROWS]);
  return csvFileResponse(csv, "registration-import-template.csv");
}
