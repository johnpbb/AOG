import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// Public endpoint — returns only bank transfer fields (no admin email)
export async function GET() {
  try {
    const config = await prisma.siteConfig.findUnique({ where: { id: "default" } });
    return NextResponse.json({
      bankName: config?.bankName ?? "",
      bankAccountName: config?.bankAccountName ?? "",
      bankAccountNumber: config?.bankAccountNumber ?? "",
      bankBranch: config?.bankBranch ?? "",
    });
  } catch {
    return NextResponse.json({ bankName: "", bankAccountName: "", bankAccountNumber: "", bankBranch: "" });
  }
}
