"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    setError("");

    const res = await fetch("/api/admin/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });

    if (res.ok) {
      setDone(true);
      setTimeout(() => router.push("/admin/login"), 2000);
    } else {
      const data = await res.json();
      setError(data.error ?? "Something went wrong.");
    }
    setLoading(false);
  }

  if (!token) {
    return (
      <div className="text-center">
        <p className="text-destructive text-sm mb-4">Invalid reset link.</p>
        <Link href="/admin/forgot-password" className="text-brand-orange text-sm hover:underline">
          Request a new one
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="text-center">
        <p className="text-brand-white font-bold text-lg mb-2">Password updated!</p>
        <p className="text-white/40 text-sm">Redirecting to sign in…</p>
      </div>
    );
  }

  return (
    <>
      <h1 className="text-brand-white font-bold text-lg mb-1">Set new password</h1>
      <p className="text-white/40 text-xs mb-6">Choose a strong password for your account.</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="New password"
          required
          minLength={8}
          autoFocus
          className="bg-white/8 border-white/15 text-brand-white placeholder:text-white/30 focus-visible:border-brand-orange focus-visible:ring-brand-orange/30"
        />
        <Input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Confirm password"
          required
          className="bg-white/8 border-white/15 text-brand-white placeholder:text-white/30 focus-visible:border-brand-orange focus-visible:ring-brand-orange/30"
        />
        {error && <p className="text-destructive text-xs">{error}</p>}
        <Button
          type="submit"
          disabled={loading || !password || !confirm}
          className="w-full bg-brand-orange text-brand-white hover:bg-brand-orange/90"
        >
          {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Updating…</> : "Update password"}
        </Button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-brand-black flex items-center justify-center">
      <div className="w-full max-w-sm px-6">
        <div className="flex justify-center mb-8">
          <Image src="/logos/agfj100-light.png" alt="AGFJ100" width={160} height={48} className="object-contain" priority />
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-8">
          <Suspense fallback={<div className="text-white/40 text-sm text-center">Loading…</div>}>
            <ResetPasswordForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
