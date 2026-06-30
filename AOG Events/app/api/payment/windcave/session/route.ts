import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createWindcaveSession } from "@/lib/windcave-client";

export async function POST(request: Request) {
  try {
    const { bookingId, amount, customerEmail } = await request.json();

    if (!bookingId || amount === undefined) {
      return NextResponse.json({ error: "Missing bookingId or amount" }, { status: 400 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl) {
      return NextResponse.json({ error: "NEXT_PUBLIC_APP_URL not configured" }, { status: 500 });
    }

    // Windcave appends ?sessionId=... to each callback URL on return.
    const base = `${appUrl}/register/verify?regId=${encodeURIComponent(bookingId)}&gateway=windcave`;

    const { sessionId, hppUrl } = await createWindcaveSession({
      registrationId: bookingId,
      amount: Number(amount),
      customerEmail,
      approvedUrl: base,
      declinedUrl: `${base}&result=declined`,
      cancelledUrl: `${base}&result=cancelled`,
      notificationUrl: `${appUrl}/api/webhooks/windcave`,
    });

    // Persist the session id so the webhook / verify can reconcile by regId.
    await prisma.registration
      .update({ where: { registrationId: bookingId }, data: { paymentSessionId: sessionId } })
      .catch((e) => console.error("Could not store Windcave session id:", e));

    return NextResponse.json({ sessionId, hppUrl });
  } catch (error: any) {
    console.error("Windcave Session Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
