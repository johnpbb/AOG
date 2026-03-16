import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

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

    // Fetch the order from ANZ to verify status
    const url = `https://${gatewayUrl}/api/rest/version/${apiVersion}/merchant/${merchantId}/order/${anzId}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${encodedAuth}`
      }
    });

    const data = await response.json();
    
    const isSuccess = data.result === 'SUCCESS' || data.status === 'CAPTURED';

    if (isSuccess) {
      // Update database status
      await prisma.registration.update({
        where: { registrationId: regId },
        data: {
          paymentStatus: 'COMPLETED',
          paymentRef: resultIndicator,
          // You could also store raw response in formData or a separate field if needed
        }
      });
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
