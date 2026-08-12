import * as XLSX from "xlsx";

// Shared by the CSV/Excel importers (admin registrations import, attendee
// list upload) so both accept the same file types and produce the same
// header-keyed row shape regardless of format.

export function isExcelFilename(name: string): boolean {
  return /\.(xlsx|xls)$/i.test(name);
}

export interface ParsedTabularData {
  fields: string[];
  data: Record<string, string>[];
}

export function parseExcelBuffer(buffer: ArrayBuffer): ParsedTabularData {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  const sheet = sheetName ? workbook.Sheets[sheetName] : null;
  if (!sheet) return { fields: [], data: [] };

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false });
  const fields = rows.length > 0 ? Object.keys(rows[0]) : [];
  const data = rows.map((row) => {
    const out: Record<string, string> = {};
    for (const key of fields) out[key] = String(row[key] ?? "").trim();
    return out;
  });
  return { fields, data };
}
