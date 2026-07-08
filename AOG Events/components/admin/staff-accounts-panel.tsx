"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, ShieldCheck, UserX, UserCheck, Pencil, X, Check, KeyRound } from "lucide-react";
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
  const [currentUser, setCurrentUser] = useState<StaffUser | null>(null);
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "FINANCE" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", email: "", role: "FINANCE" });
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "" });
  const [savingEdit, setSavingEdit] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);

  const isSuperAdmin = currentUser?.role === "SUPER_ADMIN";

  function load() {
    setLoading(true);
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then((data) => setUsers(data.users ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    fetch("/api/admin/me")
      .then((r) => r.json())
      .then((data) => setCurrentUser(data.user ?? null));
  }, []);

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
    setRowError(null);
    const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      setRowError(data.error || "Failed to deactivate account");
      return;
    }
    load();
  }

  async function handleReactivate(id: string) {
    setRowError(null);
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: true }),
    });
    if (!res.ok) {
      const data = await res.json();
      setRowError(data.error || "Failed to reactivate account");
      return;
    }
    load();
  }

  function startEdit(u: StaffUser) {
    setRowError(null);
    setEditingId(u.id);
    setEditForm({ name: u.name, email: u.email, role: u.role });
    setChangingPassword(false);
    setPasswordForm({ currentPassword: "", newPassword: "" });
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function handleSaveEdit(id: string, isSelf: boolean) {
    setSavingEdit(true);
    setRowError(null);

    const payload: Record<string, string> = { name: editForm.name, email: editForm.email };
    if (isSelf) {
      if (changingPassword) {
        payload.currentPassword = passwordForm.currentPassword;
        payload.newPassword = passwordForm.newPassword;
      }
    } else {
      payload.role = editForm.role;
    }

    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const data = await res.json();
      setRowError(data.error || "Failed to update account");
      setSavingEdit(false);
      return;
    }
    setSavingEdit(false);
    setEditingId(null);
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

      {isSuperAdmin && (
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
      )}

      {rowError && <p className="text-sm text-destructive">{rowError}</p>}

      <div className="rounded-lg border border-border bg-card divide-y divide-border">
        {loading ? (
          <div className="p-6 text-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mx-auto" />
          </div>
        ) : (
          users.map((u) => {
            const isSelf = currentUser?.id === u.id;
            const canEdit = isSuperAdmin || isSelf;
            const canDeactivate = isSuperAdmin && !isSelf;

            if (editingId === u.id) {
              return (
                <div key={u.id} className="flex flex-col gap-3 p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Input
                      placeholder="Full name"
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    />
                    <Input
                      type="email"
                      placeholder="Email"
                      value={editForm.email}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    />
                    {!isSelf && (
                      <Select value={editForm.role} onValueChange={(v) => setEditForm({ ...editForm, role: v })}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="FINANCE">Finance</SelectItem>
                          <SelectItem value="ADMIN">Admin</SelectItem>
                          <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  {isSelf && (
                    <div className="space-y-2">
                      {!changingPassword ? (
                        <Button type="button" variant="outline" size="sm" onClick={() => setChangingPassword(true)}>
                          <KeyRound className="h-4 w-4 mr-2" />
                          Change password
                        </Button>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <Input
                            type="password"
                            placeholder="Current password"
                            value={passwordForm.currentPassword}
                            onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                          />
                          <Input
                            type="password"
                            placeholder="New password"
                            value={passwordForm.newPassword}
                            onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <Button size="sm" disabled={savingEdit} onClick={() => handleSaveEdit(u.id, isSelf)}>
                      {savingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    </Button>
                    <Button size="sm" variant="ghost" disabled={savingEdit} onClick={cancelEdit}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            }

            return (
              <div key={u.id} className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium text-foreground flex items-center gap-2">
                    {u.name}
                    {u.role === "SUPER_ADMIN" && <ShieldCheck className="h-4 w-4 text-primary" />}
                    {isSelf && <span className="text-xs text-muted-foreground">(you)</span>}
                    {!u.isActive && <span className="text-xs text-muted-foreground">(deactivated)</span>}
                  </p>
                  <p className="text-sm text-muted-foreground">{u.email} · {u.role}</p>
                </div>
                <div className="flex items-center gap-1">
                  {canEdit && (
                    <Button variant="ghost" size="sm" onClick={() => startEdit(u)}>
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                  )}
                  {canDeactivate && (
                    u.isActive ? (
                      <Button variant="ghost" size="sm" onClick={() => handleDeactivate(u.id)}>
                        <UserX className="h-4 w-4 mr-2" />
                        Deactivate
                      </Button>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => handleReactivate(u.id)}>
                        <UserCheck className="h-4 w-4 mr-2" />
                        Reactivate
                      </Button>
                    )
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
