import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { NextResponse } from "next/server";

async function getConfig() {
  return prisma.siteConfig.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default" },
  });
}

export async function GET() {
  if (!(await getCurrentUser())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const config = await getConfig();
    return NextResponse.json(config);
  } catch (error) {
    console.error("Settings GET error:", error);
    return NextResponse.json({ error: "Failed to load settings" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  if (!(await getCurrentUser())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await req.json();
    const { bankName, bankAccountName, bankAccountNumber, bankBranch, notificationEmail } = body;

    // ISO string, null/"" to reopen, or absent to leave unchanged.
    let registrationClosesAt: Date | null | undefined = undefined;
    if ("registrationClosesAt" in body) {
      const raw = body.registrationClosesAt;
      if (raw === null || raw === "") {
        registrationClosesAt = null;
      } else {
        const d = new Date(raw);
        if (isNaN(d.getTime())) {
          return NextResponse.json({ error: "Invalid registration close date" }, { status: 400 });
        }
        registrationClosesAt = d;
      }
    }

    const data = { bankName, bankAccountName, bankAccountNumber, bankBranch, notificationEmail, registrationClosesAt };
    const config = await prisma.siteConfig.upsert({
      where: { id: "default" },
      update: data,
      create: { id: "default", ...data },
    });

    return NextResponse.json(config);
  } catch (error) {
    console.error("Settings PUT error:", error);
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }
}
