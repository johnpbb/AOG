import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { DEFAULT_TEMPLATES, TEMPLATE_NAMES } from "@/lib/email-defaults";

// Ensure all 4 default templates exist in the DB, creating any that are missing.
async function ensureDefaults() {
  await Promise.all(
    TEMPLATE_NAMES.map((name) =>
      prisma.emailTemplate.upsert({
        where: { id: name },
        update: {},
        create: { id: name, ...DEFAULT_TEMPLATES[name] },
      })
    )
  );
}

export async function GET() {
  try {
    await ensureDefaults();
    const templates = await prisma.emailTemplate.findMany({
      orderBy: { id: "asc" },
    });
    return NextResponse.json(templates);
  } catch (error) {
    console.error("Email templates GET error:", error);
    return NextResponse.json({ error: "Failed to load templates" }, { status: 500 });
  }
}
