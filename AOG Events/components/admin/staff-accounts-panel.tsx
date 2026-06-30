"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, ShieldCheck, UserX } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface StaffUser {
  id: string;
  name: string;
  email: string;
  role: "SUPER_ADMIN" | "FINANCE" | "ADMIN";
  isActive: boolean;
}

export function StaffAccountsPanel() {
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "FINANCE" });

  function load() {
    setLoading(true);
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then((data) => setUsers(data.users ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setForm({ name: "", email: "", password: "", role: "FINANCE" });
      load();
    } else {
      const data = await res.json();
      setError(data.error || "Failed to create staff account");
    }
    setCreating(false);
  }

  async function handleDeactivate(id: string) {
    if (!confirm("Deactivate this staff account? They will no longer be able to log in.")) return;
    await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Staff Accounts</h2>
        <p className="text-sm text-muted-foreground">
          Each staff member has their own login, so payment approvals can be attributed to a real person.
        </p>
      </div>

      <form onSubmit={handleCreate} className="rounded-lg border border-border bg-card p-6 space-y-3">
        <h3 className="text-sm font-medium text-foreground">Add staff member</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Input type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          <Input type="password" placeholder="Temporary password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="FINANCE">Finance</SelectItem>
              <SelectItem value="ADMIN">Admin</SelectItem>
              <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={creating}>
          {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
          Add staff member
        </Button>
      </form>

      <div className="rounded-lg border border-border bg-card divide-y divide-border">
        {loading ? (
          <div className="p-6 text-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mx-auto" />
          </div>
        ) : (
          users.map((u) => (
            <div key={u.id} className="flex items-center justify-between p-4">
              <div>
                <p className="font-medium text-foreground flex items-center gap-2">
                  {u.name}
                  {u.role === "SUPER_ADMIN" && <ShieldCheck className="h-4 w-4 text-primary" />}
                  {!u.isActive && <span className="text-xs text-muted-foreground">(deactivated)</span>}
                </p>
                <p className="text-sm text-muted-foreground">{u.email} · {u.role}</p>
              </div>
              {u.isActive && (
                <Button variant="ghost" size="sm" onClick={() => handleDeactivate(u.id)}>
                  <UserX className="h-4 w-4 mr-2" />
                  Deactivate
                </Button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
