'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import { Leaf, XCircle, CheckCircle2, Loader2 } from 'lucide-react';
import Link from 'next/link';
import Script from 'next/script';

const HYPERPAY_WIDGET_URL = 'https://test.oppwa.com/v1/paymentWidgets.js?checkoutId=';

function HyperPayWidget() {
  const searchParams = useSearchParams();
  const checkoutId = searchParams.get('checkoutId');
  const orderId = searchParams.get('orderId');
  const [status, setStatus] = useState<'loading' | 'ready' | 'success' | 'error' | 'cancelled'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!checkoutId) {
      setStatus('error');
      setErrorMsg('No checkout ID provided');
    }
  }, [checkoutId]);

  useEffect(() => {
    if (status !== 'ready' || !checkoutId) return;

    const script = document.createElement('script');
    script.src = `${HYPERPAY_WIDGET_URL}${checkoutId}`;
    script.async = true;
    script.onload = () => {
      const wp = (window as unknown as Record<string, unknown>).WallabyPaymentForm;
      if (wp) {
        (wp as { init: (opts: Record<string, unknown>) => void }).init({
          widget: { checkoutId },
          paymentType: 'PA',
          lang: 'en',
          async onSuccess(_response: unknown) {
            setStatus('success');
            setTimeout(() => { window.location.href = '/menu'; }, 3000);
          },
          onError(response: { message?: string }) {
            setStatus('error');
            setErrorMsg(response?.message ?? 'Payment failed');
          },
          onCancel() {
            setStatus('cancelled');
          },
        });
      }
    };
    script.onerror = () => {
      setStatus('error');
      setErrorMsg('Failed to load payment widget');
    };
    document.getElementById('payment-form')?.appendChild(script);

    return () => { script.remove(); };
  }, [status, checkoutId]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {status === 'loading' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 text-center">
            <Leaf className="w-10 h-10 text-emerald-600 mx-auto mb-4 animate-pulse" />
            <p className="text-gray-600">Loading payment form...</p>
          </div>
        )}

        {status === 'error' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 text-center">
            <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-lg font-bold text-gray-900 mb-2">Payment Failed</h2>
            <p className="text-sm text-gray-500 mb-6">{errorMsg}</p>
            <Link href="/menu" className="inline-block bg-emerald-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors">
              Back to Menu
            </Link>
          </div>
        )}

        {status === 'cancelled' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 text-center">
            <XCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
            <h2 className="text-lg font-bold text-gray-900 mb-2">Payment Cancelled</h2>
            <p className="text-sm text-gray-500 mb-6">You cancelled the payment process.</p>
            <Link href="/menu" className="inline-block bg-emerald-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors">
              Back to Menu
            </Link>
          </div>
        )}

        {status === 'success' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
            <h2 className="text-lg font-bold text-gray-900 mb-2">Payment Successful!</h2>
            <p className="text-sm text-gray-500 mb-2">Order: {orderId}</p>
            <p className="text-sm text-gray-500">Redirecting to menu...</p>
          </div>
        )}

        {(status === 'ready' || status === 'loading') && checkoutId && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-1">Complete Payment</h2>
            <p className="text-sm text-gray-500 mb-4">Order: {orderId}</p>
            <div id="payment-form" className="min-h-[200px]">
              <noscript>
                <p className="text-red-500 text-sm">JavaScript is required for the payment form.</p>
              </noscript>
            </div>
            <div className="mt-4 text-center">
              <Link href="/menu" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
                Cancel and go back
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function HyperPayPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
      </div>
    }>
      <HyperPayWidget />
    </Suspense>
  );
}
