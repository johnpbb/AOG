"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Lock } from "lucide-react";

export default function AdminLoginPage() {
  const router = useRouter();
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
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      router.push("/admin");
    } else {
      setError("Incorrect password. Please try again.");
      setPassword("");
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-brand-black flex items-center justify-center font-poppins">
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
            <div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                required
                autoFocus
                className="w-full bg-white/8 border border-white/15 rounded-lg px-4 py-3 text-brand-white placeholder:text-white/30 text-sm outline-none focus:border-brand-orange transition-colors"
              />
            </div>

            {error && (
              <p className="text-red-400 text-xs">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !password}
              className="w-full bg-brand-orange text-white font-bold py-3 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-brand-orange/90 transition-colors"
            >
              {loading ? "Checking…" : "Sign In"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
