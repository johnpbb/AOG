"use client";

import { useEffect, useRef, useState } from "react";
import Papa from "papaparse";
import { Upload, Download, AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toCSV } from "@/lib/csv";
import { isExcelFilename, parseExcelBuffer } from "@/lib/parse-tabular";
import { YOUTH_AGE_RANGE } from "@/lib/types";
import {
  ATTENDEE_CSV_HEADERS,
  ATTENDEE_CSV_TEMPLATE_EXAMPLE_ROWS,
  validateAttendeeCsvRows,
  type ParsedAttendeeCsvRow,
} from "@/lib/attendee-csv-schema";

interface AttendeeCsvUploadProps {
  // Called with every valid, named attendee (Adults/Youth only) whenever the
  // parsed file changes — null while no valid file has been uploaded yet.
  onChange: (attendees: { firstName: string; lastName: string; ageCategory: "ADULT" | "YOUTH"; email?: string; phone?: string }[] | null) => void;
}

function downloadTemplate() {
  const csv = toCSV([[...ATTENDEE_CSV_HEADERS], ...ATTENDEE_CSV_TEMPLATE_EXAMPLE_ROWS]);
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "attendee-list-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function AttendeeCsvUpload({ onChange }: AttendeeCsvUploadProps) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [rows, setRows] = useState<ParsedAttendeeCsvRow[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validRows = rows?.filter((r) => r.errors.length === 0 && r.attendee) ?? [];
  const invalidCount = rows ? rows.length - validRows.length : 0;
  const adultCount = validRows.filter((r) => r.attendee?.ageCategory === "ADULT").length;
  const youthCount = validRows.filter((r) => r.attendee?.ageCategory === "YOUTH").length;

  useEffect(() => {
    if (!rows) {
      onChange(null);
      return;
    }
    onChange(invalidCount === 0 ? validRows.map((r) => r.attendee!) : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  const applyParsedRows = (fields: string[], data: Record<string, string>[]) => {
    const missingHeaders = ATTENDEE_CSV_HEADERS.filter((h) => !fields.includes(h));
    if (missingHeaders.length > 0) {
      setParseError(`Missing column(s): ${missingHeaders.join(", ")}. Please use the downloadable template.`);
      return;
    }
    if (data.length === 0) {
      setParseError("This file has no attendee rows.");
      return;
    }
    if (data.length > 2000) {
      setParseError("This file has too many rows (max 2000).");
      return;
    }
    setRows(validateAttendeeCsvRows(data));
  };

  const handleFile = async (file: File) => {
    setFileName(file.name);
    setParseError(null);
    setRows(null);

    if (isExcelFilename(file.name)) {
      try {
        const buffer = await file.arrayBuffer();
        const { fields, data } = parseExcelBuffer(buffer);
        if (fields.length === 0) {
          setParseError("Could not read the Excel file — make sure it has a header row and at least one data row.");
          return;
        }
        applyParsedRows(fields, data);
      } catch {
        setParseError("Could not read the Excel file. Please try again.");
      }
      return;
    }

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => applyParsedRows(results.meta.fields ?? [], results.data),
      error: (err) => setParseError(err.message),
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          One row per attendee — Adults &amp; NextGen Youth ({YOUTH_AGE_RANGE}) only. Do not include kids;
          they&apos;re counted separately below.
        </p>
        <button
          type="button"
          onClick={downloadTemplate}
          className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline shrink-0"
        >
          <Download className="h-3.5 w-3.5" /> Download template
        </button>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          const f = e.dataTransfer.files?.[0];
          if (f) handleFile(f);
        }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
          isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
        )}
      >
        <Upload className="h-7 w-7 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-foreground font-medium">{fileName ?? "Drop your attendee list (CSV or Excel) here, or click to choose"}</p>
        <p className="text-xs text-muted-foreground mt-1">Matches the columns in the downloadable template</p>
        {fileName && (
          <p className="text-xs text-muted-foreground mt-1">Uploading another file will replace this one — no need to remove it first.</p>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />
      </div>

      {parseError && (
        <div role="alert" className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">
          {parseError}
        </div>
      )}

      {rows && (
        <>
          <div className="flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1.5 text-green-700">
              <CheckCircle2 className="h-4 w-4" /> {validRows.length} attendee{validRows.length === 1 ? "" : "s"} ready
            </span>
            {invalidCount > 0 && (
              <span className="flex items-center gap-1.5 text-destructive">
                <AlertCircle className="h-4 w-4" /> {invalidCount} row{invalidCount === 1 ? "" : "s"} with errors
              </span>
            )}
          </div>

          {validRows.length > 0 && (
            <div className="flex items-center gap-6 p-3 rounded-lg bg-background border border-border text-sm">
              <div>
                <span className="text-muted-foreground">Adults</span>{" "}
                <span className="font-semibold text-foreground">{adultCount}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Youth</span>{" "}
                <span className="font-semibold text-foreground">{youthCount}</span>
              </div>
              <div className="ml-auto">
                <span className="text-muted-foreground">Total</span>{" "}
                <span className="font-semibold text-primary">{validRows.length}</span>
              </div>
            </div>
          )}

          <div className="max-h-64 overflow-y-auto border border-border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-secondary sticky top-0">
                <tr>
                  <th className="text-left p-2 font-medium">Row</th>
                  <th className="text-left p-2 font-medium">Name</th>
                  <th className="text-left p-2 font-medium">Age Category</th>
                  <th className="text-left p-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.rowNumber} className={cn("border-t border-border", r.errors.length > 0 && "bg-destructive/5")}>
                    <td className="p-2 text-muted-foreground">{r.rowNumber}</td>
                    <td className="p-2">{r.raw["First Name"]} {r.raw["Last Name"]}</td>
                    <td className="p-2">{r.raw["Age Category"]}</td>
                    <td className="p-2">
                      {r.errors.length === 0 ? (
                        <span className="text-green-700">Ready</span>
                      ) : (
                        <span className="text-destructive">{r.errors.join("; ")}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {invalidCount > 0 && (
            <p className="text-destructive text-xs">
              Fix the row(s) with errors and re-upload before submitting — the new file will replace this one.
            </p>
          )}
        </>
      )}
    </div>
  );
}
