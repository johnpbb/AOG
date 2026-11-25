import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { isStaffRole } from "@/lib/roles";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const isSelf = id === currentUser.id;

  if (!isSelf && currentUser.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Only a super admin can edit other staff accounts" }, { status: 403 });
  }

  const { name, email, role, isActive, currentPassword, newPassword } = await req.json();

  // Nobody may change their own role or active status — even a super admin —
  // so a slip in the edit form can't strip your own access or lock you out.
  if (isSelf && (role !== undefined || isActive !== undefined)) {
    return NextResponse.json(
      { error: "You cannot change your own role or active status" },
      { status: 400 }
    );
  }

  // Direct password changes are self-service only; a super admin changing
  // someone else's account should send them a reset link instead.
  if (!isSelf && (currentPassword !== undefined || newPassword !== undefined)) {
    return NextResponse.json(
      { error: "Use the password reset link to change another user's password" },
      { status: 400 }
    );
  }

  if (role !== undefined && !isStaffRole(role)) {
    return NextResponse.json({ error: "Unknown role" }, { status: 400 });
  }

  let passwordHash: string | undefined;
  if (isSelf && newPassword !== undefined) {
    if (!currentPassword) {
      return NextResponse.json({ error: "Current password is required" }, { status: 400 });
    }
    const valid = await bcrypt.compare(currentPassword, currentUser.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
    }
    if (String(newPassword).length < 8) {
      return NextResponse.json({ error: "New password must be at least 8 characters" }, { status: 400 });
    }
    passwordHash = await bcrypt.hash(newPassword, 12);
  }

  try {
    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(email !== undefined ? { email: String(email).toLowerCase() } : {}),
        ...(role !== undefined ? { role } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
        ...(passwordHash !== undefined ? { passwordHash } : {}),
      },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });
    return NextResponse.json({ user });
  } catch (error: any) {
    if (error.code === "P2002") {
      return NextResponse.json({ error: "A user with that email already exists" }, { status: 409 });
    }
    throw error;
  }
}

// DELETE /api/admin/users/[id] — deactivate by default (keeps the audit
// trail). With ?permanent=true a super admin removes the account entirely;
// payments they confirmed stay but lose their "Confirmed by" name.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Only a super admin can remove staff accounts" }, { status: 403 });
  }

  const { id } = await params;
  if (id === currentUser.id) {
    return NextResponse.json({ error: "You cannot deactivate or delete your own account" }, { status: 400 });
  }

  const permanent = req.nextUrl.searchParams.get("permanent") === "true";

  if (permanent) {
    const target = await prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!target) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    await prisma.$transaction([
      prisma.payment.updateMany({ where: { confirmedById: id }, data: { confirmedById: null } }),
      prisma.user.delete({ where: { id } }), // password reset tokens cascade
    ]);
    return NextResponse.json({ ok: true, deleted: true });
  }

  // Default: deactivate rather than delete, so Payment.confirmedBy keeps its audit trail.
  await prisma.user.update({ where: { id }, data: { isActive: false } });

  return NextResponse.json({ ok: true });
}
