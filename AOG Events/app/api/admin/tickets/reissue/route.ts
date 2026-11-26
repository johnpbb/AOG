import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { isUsableEmail, type TicketEmailRecord } from "@/lib/send-registration-tickets";

// GET /api/admin/tickets/reissue — every fully paid registration with its
// active ticket count and the last ticket-email outcome, for the bulk
// reissue screen. Sending itself goes through
// /api/admin/registrations/[id]/resend-tickets, one registration at a time.
export async function GET() {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const regs = await prisma.registration.findMany({
    where: { paymentStatus: "COMPLETED" },
    select: {
      id: true,
      registrationId: true,
      email: true,
      category: true,
      registrarName: true,
      formData: true,
      church: { select: { name: true } },
      _count: { select: { tickets: { where: { status: "ACTIVE" } } } },
    },
    orderBy: { registrationId: "asc" },
  });

  return NextResponse.json(
    regs.map((r) => {
      const fd = (r.formData ?? {}) as Record<string, any>;
      const name =
        r.church?.name ||
        fd.pastorName ||
        (fd.firstName ? `${fd.firstName} ${fd.lastName ?? ""}`.trim() : null) ||
        r.registrarName ||
        r.email;
      return {
        id: r.id,
        registrationId: r.registrationId,
        name,
        email: r.email,
        emailUsable: isUsableEmail(r.email),
        category: r.category,
        activeTickets: r._count.tickets,
        ticketEmail: (fd.ticketEmail ?? null) as TicketEmailRecord | null,
      };
    })
  );
}
