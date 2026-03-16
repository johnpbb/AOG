
export const loadAnzScript = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return resolve();
    if ((window as any).Checkout) return resolve();

    const script = document.createElement('script');
    script.src = `https://${process.env.NEXT_PUBLIC_ANZ_GATEWAY_URL}/static/checkout/checkout.min.js`;
    script.setAttribute('data-error', 'errorCallback');
    script.setAttribute('data-cancel', 'cancelCallback');
    script.onload = () => resolve();
    script.onerror = (err) => reject(err);
    document.body.appendChild(script);
  });
};

export const initAnzPayment = async (
  sessionId: string,
  merchantId: string,
  onComplete: (resultIndicator: string, sessionVersion: string) => void,
  onCancel: () => void,
  onError: (error: any) => void
) => {
  const Checkout = (window as any).Checkout;
  if (!Checkout) {
    onError(new Error('ANZ Checkout script not found'));
    return;
  }

  // Globally define callbacks that ANZ expects
  (window as any).errorCallback = (error: any) => {
    console.error('ANZ Error:', error);
    onError(error);
  };

  (window as any).cancelCallback = () => {
    console.log('ANZ Payment Cancelled');
    onCancel();
  };

  Checkout.configure({
    session: {
      id: sessionId
    }
  });

  Checkout.showPaymentPage();
};
