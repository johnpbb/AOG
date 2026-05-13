"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Loader2, CheckCircle2, XCircle, ArrowRight } from "lucide-react";

function VerifyContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<"verifying" | "success" | "failed">("verifying");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const regId = searchParams.get("regId");
    const anzId = searchParams.get("anzId");
    const resultIndicator = searchParams.get("resultIndicator");

    if (regId && anzId && resultIndicator) {
      verifyPayment(regId, anzId, resultIndicator);
    } else {
      setStatus("failed");
      setMessage("Missing payment information");
    }
  }, [searchParams]);

  const verifyPayment = async (regId: string, anzId: string, resultIndicator: string) => {
    try {
      const resp = await fetch(`/api/payment/anz/verify?regId=${regId}&anzId=${anzId}&resultIndicator=${resultIndicator}`);
      const data = await resp.json();

      if (data.status === "success") {
        setStatus("success");
      } else {
        setStatus("failed");
        setMessage(data.message || "Payment verification failed");
      }
    } catch {
      setStatus("failed");
      setMessage("An error occurred during verification");
    }
  };

  return (
    <main className="flex-1 flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-[440px] bg-white/[0.04] border border-brand-orange/20 rounded-[20px] px-10 py-12 text-center">

        {status === "verifying" && (
          <div className="flex flex-col items-center gap-5">
            <Loader2 size={48} className="text-brand-orange animate-spin" />
            <h1 className="text-[22px] font-bold text-brand-white">Verifying Payment</h1>
            <p className="text-sm text-white/50 leading-[1.6]">
              Please wait while we confirm your transaction with ANZ…
            </p>
          </div>
        )}

        {status === "success" && (
          <div className="flex flex-col items-center gap-5">
            <CheckCircle2 size={52} color="#22c55e" />
            <h1 className="text-[22px] font-bold text-brand-white">Payment Successful</h1>
            <p className="text-sm text-white/50 leading-[1.6]">
              Your registration has been confirmed. You will receive a confirmation email shortly.
            </p>
            <button
              onClick={() => router.push("/")}
              className="mt-2 inline-flex items-center gap-2 bg-brand-orange text-brand-white px-7 py-3 rounded-lg font-bold text-sm cursor-pointer border-none font-poppins tracking-[0.02em]"
            >
              Return to Home <ArrowRight size={15} />
            </button>
          </div>
        )}

        {status === "failed" && (
          <div className="flex flex-col items-center gap-5">
            <XCircle size={52} color="#ef4444" />
            <h1 className="text-[22px] font-bold text-brand-white">Payment Failed</h1>
            <p className="text-sm text-[#f87171] leading-[1.6]">{message}</p>
            <button
              onClick={() => router.push("/")}
              className="mt-2 inline-flex items-center gap-2 bg-white/8 text-brand-white px-7 py-3 rounded-lg font-semibold text-sm cursor-pointer border border-white/15 font-poppins"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

export default function VerifyPage() {
  return (
    <div className="bg-brand-black text-brand-white font-poppins min-h-screen flex flex-col">

      {/* ── NAV ───────────────────────────────────────────────────────────── */}
      <nav className="brand-nav sticky">
        <div className="max-w-[1280px] mx-auto px-6 flex items-center h-[68px]">
          <Link href="/">
            <Image src="/logos/agfj100-dark.png" alt="AGFJ100" width={160} height={48} className="object-contain" priority />
          </Link>
        </div>
      </nav>

      <Suspense fallback={
        <main className="flex-1 flex items-center justify-center px-6 py-10">
          <div className="text-center">
            <Loader2 size={40} className="text-brand-orange animate-spin mx-auto mb-4" />
            <p className="text-white/50 text-sm">Loading verification…</p>
          </div>
        </main>
      }>
        <VerifyContent />
      </Suspense>

      {/* ── FOOTER ──────────────────────────────────────────────────────────── */}
      <footer className="bg-[#050505] border-t border-brand-orange/12 py-[44px] px-6">
        <div className="max-w-[1280px] mx-auto flex flex-col items-center gap-5 text-center">
          <Image src="/logos/agfj100-dark.png" alt="AGFJ100" width={130} height={42} className="object-contain opacity-70" />
          <p className="text-xs text-white/30">© 2026 Assemblies of God, Fiji. All rights reserved.</p>
          <div className="flex gap-7 text-[13px]">
            <Link href="/admin" className="text-white/35 no-underline">Admin</Link>
            <span className="text-white/[0.18]">·</span>
            <span className="text-white/25">Powered by VaizeePay</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
