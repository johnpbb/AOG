import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

async function getConfig() {
  return prisma.siteConfig.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default" },
  });
}

export async function GET() {
  try {
    const config = await getConfig();
    return NextResponse.json(config);
  } catch (error) {
    console.error("Settings GET error:", error);
    return NextResponse.json({ error: "Failed to load settings" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const {
      bankName, bankAccountName, bankAccountNumber, bankBranch,
      mpaisaNumber, mpaisaName, worldRemitInstructions,
      notificationEmail,
    } = body;

    const data = {
      bankName, bankAccountName, bankAccountNumber, bankBranch,
      mpaisaNumber, mpaisaName, worldRemitInstructions,
      notificationEmail,
    };

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
