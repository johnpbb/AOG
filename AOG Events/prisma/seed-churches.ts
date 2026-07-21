// Seeds the Church table from the official AG Fiji General Secretary's list.
// Source: prisma/data/aog-fiji-churches.csv (exported from the General
// Secretary's "AOG FIJI LOCAL CHURCH AND MEMBERSHIP SUMMARY" spreadsheet).
//
// Per the client's spec, churches are NOT locked to a category in the data
// model — the spreadsheet's "category" column is used only to pre-fill the
// category step at registration; the registrant can always pick a different
// category manually, and the system validates attendee counts against
// whatever category is actually chosen.
//
// Run with: npx tsx prisma/seed-churches.ts
import "dotenv/config";
import { readFileSync } from "fs";
import path from "path";
import { prisma } from "../lib/prisma";
import { RegistrationCategory } from "../lib/types";

interface ChurchRow {
  id: string;
  name: string;
  district: string;
  category: RegistrationCategory | null;
}

// The source CSV has church names containing commas (e.g. "GOOD NEWS, RA"),
// quoted per RFC4180. A plain `line.split(",")` silently corrupts those rows,
// so this is a small quote-aware parser rather than a naive split.
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

// Maps the spreadsheet's HQ category labels onto this app's registration
// category ids. Blank/unrecognized values (mostly new preaching points that
// haven't been size-classified yet) are left unset — the registrant just
// picks a category manually with no pre-fill, same as before this feature.
const CATEGORY_MAP: Record<string, RegistrationCategory> = {
  "VERY LARGE": "very-large-church",
  LARGE: "large-church",
  MEDIUM: "medium-church",
  SMALL: "small-church",
};

function parseCsv(filePath: string): ChurchRow[] {
  const text = readFileSync(filePath, "utf-8");
  const lines = text.trim().split("\n").slice(1); // skip header
  return lines.map((line) => {
    const [id, name, division, district, category] = parseCsvLine(line).map((f) => f.trim());
    return {
      id,
      name,
      district: district || division || "",
      category: CATEGORY_MAP[(category || "").toUpperCase()] ?? null,
    };
  });
}

// Placeholder overseas World Fijian Congress entries — the official
// per-country (Australia/New Zealand/USA/Great Britain) church lists have
// not yet been supplied by the client. IDs start at 900 to leave headroom
// for the Fiji-local list (currently up to 408) to keep growing without
// colliding. Replace/extend once the client provides the real WFC lists.
const WFC_PLACEHOLDER_CHURCHES: ChurchRow[] = [
  { id: "900", name: "World Fijian Congress — Australia (TBC)", district: "", category: null },
  { id: "901", name: "World Fijian Congress — New Zealand (TBC)", district: "", category: null },
  { id: "902", name: "World Fijian Congress — USA (TBC)", district: "", category: null },
  { id: "903", name: "World Fijian Congress — Great Britain (TBC)", district: "", category: null },
];

const WFC_COUNTRY_BY_ID: Record<string, string> = {
  "900": "Australia",
  "901": "New Zealand",
  "902": "USA",
  "903": "United Kingdom",
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
        category: church.category,
        country: WFC_COUNTRY_BY_ID[church.id] ?? "Fiji",
      },
      create: {
        id: church.id,
        name: church.name,
        district: church.district || null,
        category: church.category,
        country: WFC_COUNTRY_BY_ID[church.id] ?? "Fiji",
      },
    });
  }

  const withCategory = fijiChurches.filter((c) => c.category !== null).length;
  console.log(
    `Seeded ${allChurches.length} churches (${fijiChurches.length} Fiji-local, ${WFC_PLACEHOLDER_CHURCHES.length} WFC placeholders). ` +
      `${withCategory} of ${fijiChurches.length} Fiji-local churches have a known category.`
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
