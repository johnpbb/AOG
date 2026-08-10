import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { sendTicketConfirmationEmail } from '@/lib/email';
import { generateTicketsForRegistration, attachVenuesToTickets, summarizeTicketVenues, deriveRegistrationTypeLabel, formatPaymentStatusLabel } from '@/lib/tickets';
import { REGISTRATION_CATEGORIES } from '@/lib/types';
import { format } from 'date-fns';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const regId = searchParams.get('regId');
  const anzId = searchParams.get('anzId');
  const resultIndicator = searchParams.get('resultIndicator');

  if (!regId || !anzId || !resultIndicator) {
     return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
  }

  try {
    // Idempotency guard: a page refresh on the verify page would otherwise
    // re-hit the ANZ API and re-send the confirmation email every time.
    const existing = await prisma.registration.findUnique({ where: { registrationId: regId } });
    if (!existing) {
      return NextResponse.json({ error: 'Registration not found' }, { status: 404 });
    }
    if (existing.paymentStatus === 'COMPLETED') {
      return NextResponse.json({ status: 'success', message: 'Payment already confirmed' });
    }

    const merchantId = process.env.NEXT_PUBLIC_ANZ_MERCHANT_ID;
    const password = process.env.ANZ_API_PASSWORD;
    const gatewayUrl = process.env.NEXT_PUBLIC_ANZ_GATEWAY_URL; // Using client-side URL or env
    const apiVersion = process.env.ANZ_API_VERSION || '70';

    const authStr = `merchant.${merchantId}:${password}`;
    const encodedAuth = Buffer.from(authStr).toString('base64');

    // Fetch the order from ANZ to verify status with a timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const url = `https://${gatewayUrl}/api/rest/version/${apiVersion}/merchant/${merchantId}/order/${anzId}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${encodedAuth}`
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    const data = await response.json();

    const gatewaySuccess = data.result === 'SUCCESS' || data.status === 'CAPTURED';
    // Prefer the actually-captured/authorized amount over the order's nominal
    // "amount" (which just echoes what we asked for at session-creation time
    // and so would trivially "match" even if nothing was actually charged).
    // Field names aren't verified against a live ANZ/Mastercard Gateway
    // response — if none of these are present, don't block a real payment on
    // a guess: fall back to trusting the gateway's own success status alone,
    // same as before this check existed.
    const rawPaidAmount = data.totalCapturedAmount ?? data.totalAuthorizedAmount ?? data.order?.amount ?? data.amount;
    const paidAmount = rawPaidAmount === undefined ? null : Number(rawPaidAmount);
    const amountKnown = paidAmount !== null && !Number.isNaN(paidAmount);
    const amountMatches = !amountKnown || Math.abs(paidAmount - existing.fee) < 0.01;
    const isSuccess = gatewaySuccess && amountMatches;

    if (gatewaySuccess && amountKnown && !amountMatches) {
      console.error(
        `ANZ amount mismatch for ${regId}: gateway reported ${paidAmount}, expected ${existing.fee}`
      );
    }
    if (gatewaySuccess && !amountKnown) {
      console.warn(`ANZ verify: could not determine paid amount for ${regId} — proceeding on gateway status alone.`, data);
    }

    if (isSuccess) {
      // Update database status
      const updatedRegistration = await prisma.registration.update({
        where: { registrationId: regId },
        data: {
          paymentStatus: 'COMPLETED',
          paymentRef: resultIndicator,
        },
        include: {
          attendees: true,
          tickets: { include: { attendee: { select: { firstName: true, lastName: true } } } },
          event: true,
          venue: true,
          venueAllocations: { include: { venue: { select: { name: true, city: true } } } },
          church: true,
        }
      });

      // Issue entry QR tickets now that payment is confirmed (idempotent —
      // skip if a webhook already created them for this registration).
      let tickets = updatedRegistration.tickets;
      if (tickets.length === 0) {
        tickets = await prisma.$transaction((tx) =>
          generateTicketsForRegistration(
            tx,
            updatedRegistration.id,
            updatedRegistration.adults,
            updatedRegistration.youth,
            updatedRegistration.attendees
          )
        );
      }

      // Send confirmation email (don't await to avoid blocking the response)
      const name = updatedRegistration.attendees.length > 0
        ? `${updatedRegistration.attendees[0].firstName} ${updatedRegistration.attendees[0].lastName}`
        : "Attendee";

      const catInfo = REGISTRATION_CATEGORIES.find((c) => c.id === updatedRegistration.category);
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      const ticketsWithVenue = attachVenuesToTickets(tickets, updatedRegistration.venueAllocations).map((t) => ({
        ...t,
        attendeeName: t.attendee ? `${t.attendee.firstName} ${t.attendee.lastName}`.trim() : undefined,
      }));

      // Gateway payment is always treated as a single full payment.
      sendTicketConfirmationEmail({
        to: updatedRegistration.email,
        registrantName: name,
        registrationId: updatedRegistration.registrationId,
        category: catInfo?.name ?? updatedRegistration.category,
        registrationType: deriveRegistrationTypeLabel(updatedRegistration.type, updatedRegistration.category),
        churchName: updatedRegistration.church?.name,
        district: updatedRegistration.church?.district ?? undefined,
        country: updatedRegistration.church?.country,
        paymentStatusLabel: formatPaymentStatusLabel(updatedRegistration.fee, updatedRegistration.fee),
        eventName: updatedRegistration.event?.name ?? "AOG Fiji 100th Anniversary",
        eventDate: updatedRegistration.event?.startDate
          ? format(new Date(updatedRegistration.event.startDate), "d MMMM yyyy")
          : "TBC",
        venueName: summarizeTicketVenues(ticketsWithVenue) || updatedRegistration.venue?.name || "",
        venueCity: updatedRegistration.venue?.city ?? "",
        tickets: ticketsWithVenue,
        appUrl,
      }).catch(err => console.error("Background Email Error:", err));
    }

    return NextResponse.json({
      status: isSuccess ? 'success' : 'failed',
      message: isSuccess ? 'Payment verified successfully' : `Payment status: ${data.status || 'Unknown'}`,
      data: data
    });

  } catch (error: any) {
    console.error('ANZ Verification Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
