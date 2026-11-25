import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { isStaffRole } from "@/lib/roles";

export async function GET() {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await prisma.user.findMany({
    select: {
      id: true, name: true, email: true, role: true, isActive: true, createdAt: true,
      _count: { select: { paymentsConfirmed: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  // paymentsConfirmed lets the UI warn before a permanent delete, which
  // clears "Confirmed by" on those payments.
  const users = rows.map(({ _count, ...u }) => ({ ...u, paymentsConfirmed: _count.paymentsConfirmed }));

  return NextResponse.json({ users });
}

export async function POST(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Only a super admin can create staff accounts" }, { status: 403 });
  }

  const { name, email, password, role } = await req.json();
  if (!name || !email || !password) {
    return NextResponse.json({ error: "Name, email, and password are required" }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  try {
    const user = await prisma.user.create({
      data: {
        name,
        email: String(email).toLowerCase(),
        passwordHash,
        role: isStaffRole(role) ? role : "ADMIN",
      },
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
    });
    return NextResponse.json({ user });
  } catch (error: any) {
    if (error.code === "P2002") {
      return NextResponse.json({ error: "A user with that email already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}
