"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

export default function VerifyPage() {
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
    } catch (error) {
      setStatus("failed");
      setMessage("An error occurred during verification");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-20 flex flex-col items-center justify-center text-center">
        <div className="max-w-md w-full p-8 rounded-xl border border-border bg-card shadow-lg">
          {status === "verifying" && (
            <div className="space-y-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
              <h1 className="text-2xl font-bold">Verifying Payment</h1>
              <p className="text-muted-foreground">Please wait while we confirm your transaction with ANZ...</p>
            </div>
          )}

          {status === "success" && (
            <div className="space-y-4">
              <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
              <h1 className="text-2xl font-bold">Payment Successful</h1>
              <p className="text-muted-foreground">Your registration has been confirmed. You will receive an email shortly.</p>
              <Button onClick={() => router.push("/")} className="w-full mt-4">
                Return to Home
              </Button>
            </div>
          )}

          {status === "failed" && (
            <div className="space-y-4">
              <XCircle className="h-12 w-12 text-destructive mx-auto" />
              <h1 className="text-2xl font-bold">Payment Failed</h1>
              <p className="text-destructive">{message}</p>
              <Button onClick={() => router.push("/register")} className="w-full mt-4">
                Try again
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
