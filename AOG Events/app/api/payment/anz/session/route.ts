import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { bookingId, amount, customerEmail } = await request.json();

    const merchantId = process.env.NEXT_PUBLIC_ANZ_MERCHANT_ID;
    const password = process.env.ANZ_API_PASSWORD;
    const gatewayUrl = process.env.NEXT_PUBLIC_ANZ_GATEWAY_URL;
    const apiVersion = process.env.ANZ_API_VERSION || '70';

    if (!merchantId || !password || !gatewayUrl) {
      console.error('ANZ credentials not configured');
      return NextResponse.json({ error: 'ANZ credentials not configured' }, { status: 500 });
    }

    const authStr = `merchant.${merchantId}:${password}`;
    const encodedAuth = Buffer.from(authStr).toString('base64');

    const url = `https://${gatewayUrl}/api/rest/version/${apiVersion}/merchant/${merchantId}/session`;

    const anzOrderId = `${bookingId}_${Date.now()}`;

    const payload = {
      apiOperation: 'INITIATE_CHECKOUT',
      order: {
        id: anzOrderId,
        amount: Number(amount).toFixed(2),
        currency: 'TOP',
        description: `Registration ${bookingId}`
      },
      customer: {
        email: customerEmail
      },
      interaction: {
        operation: 'PURCHASE',
        returnUrl: `${process.env.NEXT_PUBLIC_APP_URL}/register/verify?regId=${bookingId}&anzId=${anzOrderId}`,
        cancelUrl: `${process.env.NEXT_PUBLIC_APP_URL}/register?regId=${bookingId}&cancel=true`,
        merchant: {
          name: 'AOG Fiji 100th Celebration'
        }
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${encodedAuth}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (data.result !== 'SUCCESS') {
       console.error('ANZ Session Error:', data);
       return NextResponse.json({ error: data.result, details: data }, { status: 400 });
    }

    return NextResponse.json({
      sessionId: data.session.id,
      successIndicator: data.successIndicator,
      merchantId: merchantId
    });

  } catch (error: any) {
    console.error('Unexpected Error in ANZ Session:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
