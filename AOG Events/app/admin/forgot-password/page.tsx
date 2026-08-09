"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await fetch("/api/admin/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setLoading(false);
    setSent(true);
  }

  return (
    <div className="min-h-screen bg-brand-black flex items-center justify-center">
      <div className="w-full max-w-sm px-6">
        <div className="flex justify-center mb-8">
          <Image src="/logos/agfj100-light.png" alt="Assemblies of God" width={72} height={72} className="object-contain" priority />
        </div>

        <div className="bg-white/5 border border-white/10 rounded-xl p-8">
          {sent ? (
            <div className="text-center">
              <p className="text-brand-white font-bold text-lg mb-2">Check your email</p>
              <p className="text-white/40 text-sm mb-6">
                If that address is registered, you'll receive a reset link shortly.
              </p>
              <Link href="/admin/login" className="text-brand-orange text-sm hover:underline">
                Back to sign in
              </Link>
            </div>
          ) : (
            <>
              <h1 className="text-brand-white font-bold text-lg mb-1">Forgot password</h1>
              <p className="text-white/40 text-xs mb-6">Enter your email and we'll send a reset link.</p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email"
                  required
                  autoFocus
                  className="bg-white/8 border-white/15 text-brand-white placeholder:text-white/30 focus-visible:border-brand-orange focus-visible:ring-brand-orange/30"
                />
                <Button
                  type="submit"
                  disabled={loading || !email}
                  className="w-full bg-brand-orange text-brand-white hover:bg-brand-orange/90"
                >
                  {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Sending…</> : "Send reset link"}
                </Button>
              </form>

              <div className="mt-4 text-center">
                <Link href="/admin/login" className="text-white/40 text-xs hover:text-white/60">
                  Back to sign in
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
