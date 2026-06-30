"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Lock, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (res.ok) {
      router.push("/admin");
    } else {
      setError("Incorrect email or password. Please try again.");
      setPassword("");
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-brand-black flex items-center justify-center">
      <div className="w-full max-w-sm px-6">
        <div className="flex justify-center mb-8">
          <Image
            src="/logos/agfj100-light.png"
            alt="AGFJ100"
            width={160}
            height={48}
            className="object-contain"
            priority
          />
        </div>

        <div className="bg-white/5 border border-white/10 rounded-xl p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-9 h-9 rounded-lg bg-brand-orange/20 flex items-center justify-center">
              <Lock size={18} className="text-brand-orange" />
            </div>
            <div>
              <h1 className="text-brand-white font-bold text-lg leading-tight">Admin Access</h1>
              <p className="text-white/40 text-xs">Enter your password to continue</p>
            </div>
          </div>

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
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              required
              className="bg-white/8 border-white/15 text-brand-white placeholder:text-white/30 focus-visible:border-brand-orange focus-visible:ring-brand-orange/30"
            />

            {error && (
              <p className="text-destructive text-xs">{error}</p>
            )}

            <Button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full bg-brand-orange text-brand-white hover:bg-brand-orange/90"
            >
              {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Checking…</> : "Sign In"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
