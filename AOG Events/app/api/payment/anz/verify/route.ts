import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { sendConfirmationEmail } from '@/lib/mail';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const regId = searchParams.get('regId');
  const anzId = searchParams.get('anzId');
  const resultIndicator = searchParams.get('resultIndicator');

  if (!regId || !anzId || !resultIndicator) {
     return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
  }

  try {
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
    
    const isSuccess = data.result === 'SUCCESS' || data.status === 'CAPTURED';

    if (isSuccess) {
      // Update database status
      const updatedRegistration = await prisma.registration.update({
        where: { registrationId: regId },
        data: {
          paymentStatus: 'COMPLETED',
          paymentRef: resultIndicator,
        },
        include: {
          attendees: true
        }
      });

      // Send confirmation email (don't await to avoid blocking the response)
      const name = updatedRegistration.attendees.length > 0 
        ? `${updatedRegistration.attendees[0].firstName} ${updatedRegistration.attendees[0].lastName}`
        : "Attendee";

      sendConfirmationEmail(
        updatedRegistration.email,
        updatedRegistration.registrationId,
        name,
        updatedRegistration.category
      ).catch(err => console.error("Background Email Error:", err));
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
