// Seeds the Church table from the official AG Fiji General Secretary's list.
// Source: prisma/data/aog-fiji-churches.csv (exported from the General
// Secretary's "AOG FIJI LOCAL CHURCH AND MEMBERSHIP SUMMARY" spreadsheet).
//
// Per the client's spec, churches are NOT locked to a category in the data
// model — the spreadsheet's "category" column is historical/HQ data only,
// not enforced. Pastors manually pick a category at registration time and
// the system validates attendee counts against it instead.
//
// Run with: npx tsx prisma/seed-churches.ts
import "dotenv/config";
import { readFileSync } from "fs";
import path from "path";
import { prisma } from "../lib/prisma";

interface ChurchRow {
  id: string;
  name: string;
  district: string;
}

function parseCsv(filePath: string): ChurchRow[] {
  const text = readFileSync(filePath, "utf-8");
  const lines = text.trim().split("\n").slice(1); // skip header
  return lines.map((line) => {
    const [id, name, division, district] = line.split(",");
    return {
      id: id.trim(),
      name: name.trim(),
      district: district?.trim() || division?.trim() || "",
    };
  });
}

// Placeholder overseas World Fijian Congress entries — the official
// per-country (Australia/New Zealand/USA/Great Britain) church lists have
// not yet been supplied by the client. IDs continue from 390 onward so they
// never collide with the 389 Fiji-local church IDs. Replace/extend once the
// client provides the real WFC lists.
const WFC_PLACEHOLDER_CHURCHES: ChurchRow[] = [
  { id: "390", name: "World Fijian Congress — Australia (TBC)", district: "" },
  { id: "391", name: "World Fijian Congress — New Zealand (TBC)", district: "" },
  { id: "392", name: "World Fijian Congress — USA (TBC)", district: "" },
  { id: "393", name: "World Fijian Congress — Great Britain (TBC)", district: "" },
];

const WFC_COUNTRY_BY_ID: Record<string, string> = {
  "390": "Australia",
  "391": "New Zealand",
  "392": "USA",
  "393": "United Kingdom",
};

async function main() {
  const csvPath = path.join(__dirname, "data", "aog-fiji-churches.csv");
  const fijiChurches = parseCsv(csvPath);
  const allChurches = [...fijiChurches, ...WFC_PLACEHOLDER_CHURCHES];

  for (const church of allChurches) {
    await prisma.church.upsert({
      where: { id: church.id },
      update: {
        name: church.name,
        district: church.district || null,
        country: WFC_COUNTRY_BY_ID[church.id] ?? "Fiji",
      },
      create: {
        id: church.id,
        name: church.name,
        district: church.district || null,
        country: WFC_COUNTRY_BY_ID[church.id] ?? "Fiji",
      },
    });
  }

  console.log(`Seeded ${allChurches.length} churches (${fijiChurches.length} Fiji-local, ${WFC_PLACEHOLDER_CHURCHES.length} WFC placeholders).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
