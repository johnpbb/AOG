import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const totalRegistrations = await prisma.registration.count();
    const totalPayments = await prisma.registration.count({
      where: {
        paymentStatus: 'COMPLETED',
      },
    });
    const pendingPayments = await prisma.registration.count({
      where: {
        paymentStatus: 'PENDING',
      },
    });

    const recentRegistrations = await prisma.registration.findMany({
      take: 5,
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Simple category breakdown
    const categories = await prisma.registration.groupBy({
      by: ['category'],
      _count: {
        category: true,
      },
    });

    return NextResponse.json({
      totalRegistrations,
      totalPayments,
      pendingPayments,
      recentRegistrations,
      categories: categories.map(c => ({
        name: c.category,
        count: c._count.category,
      })),
    });
  } catch (error: any) {
    console.error("Fetch Stats Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
