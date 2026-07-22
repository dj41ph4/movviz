"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { useT } from "@/i18n/provider";
import { useCurrentUser } from "@/lib/auth/useCurrentUser";
import { cn } from "@/lib/utils";
import type { PublicUser } from "@/lib/auth/types";
import { ShieldCheck, User as UserIcon, Loader2, Download, ShieldAlert, ChevronRight, Check, X, Hourglass, UserPlus } from "lucide-react";

export default function UsersPage() {
  const t = useT();
  const currentUser = useCurrentUser();
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = () =>
    fetch("/api/users", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { users: [] }))
      .then((d) => setUsers(d.users ?? []));

  useEffect(() => { load(); }, []);

  const patch = async (id: string, body: Record<string, unknown>) => {
    await fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    load();
  };

  const reject = async (id: string) => {
    await fetch(`/api/users/${id}`, { method: "DELETE" });
    load();
  };

  const createLocalUser = async () => {
    setCreateError(null);
    setCreating(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: newUsername, password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreateError(
          data.error === "username_taken" ? t("auth.usernameTaken")
          : data.error === "username_too_short" ? t("auth.usernameTooShort")
          : data.error === "password_too_short" ? t("auth.passwordTooShort")
          : t("auth.invalidCredentials")
        );
        return;
      }
      setCreateOpen(false);
      setNewUsername("");
      setNewPassword("");
      load();
    } finally {
      setCreating(false);
    }
  };

  const importPlexUsers = async () => {
    setImporting(true);
    setImportMsg(null);
    try {
      const res = await fetch("/api/plex/import", { method: "POST" });
      const d = await res.json();
      setImportMsg(res.ok ? t("plex.importedCount", { n: d.imported ?? 0 }) : t("plex.notConnected"));
      if (res.ok) load();
    } finally {
      setImporting(false);
    }
  };

  if (currentUser && currentUser.role !== "admin") {
    return (
      <div className="mx-auto flex max-w-[1100px] flex-col items-center gap-3 rounded-2xl glass py-24 text-center">
        <ShieldAlert className="h-8 w-8 text-down" />
        <p className="font-semibold text-ink">{t("auth.restricted")}</p>
        <p className="text-sm text-ink-dim">{t("auth.restrictedHint")}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader eyebrow={t("auth.usersEyebrow")} title={t("auth.users")} description={t("auth.usersDescription")}>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex h-10 items-center gap-2 rounded-xl brand-gradient px-4 text-sm font-semibold text-white"
        >
          <UserPlus className="h-4 w-4" /> {t("auth.createLocalUser")}
        </button>
        <button
          onClick={importPlexUsers}
          disabled={importing}
          className="flex h-10 items-center gap-2 rounded-xl glass-strong px-4 text-sm font-semibold text-ink-soft disabled:opacity-50"
        >
          {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {t("plex.importUsers")}
        </button>
      </PageHeader>
      {importMsg && <p className="-mt-4 mb-4 text-xs text-ink-dim">{importMsg}</p>}

      {createOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setCreateOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl glass-strong p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-ink">
              <UserPlus className="h-4 w-4 text-brand-glow" /> {t("auth.createLocalUser")}
            </h2>
            <div className="space-y-3">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-ink-soft">{t("auth.username")}</label>
                <input
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && createLocalUser()}
                  className="h-11 w-full rounded-xl border border-white/8 bg-black/30 px-3 text-sm text-ink outline-none focus:border-brand/40"
                  autoFocus
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-ink-soft">{t("auth.password")}</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && createLocalUser()}
                  className="h-11 w-full rounded-xl border border-white/8 bg-black/30 px-3 text-sm text-ink outline-none focus:border-brand/40"
                />
              </div>
              {createError && <p className="text-xs font-semibold text-down">{createError}</p>}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setCreateOpen(false)}
                  className="flex h-10 flex-1 items-center justify-center rounded-xl glass text-sm font-semibold text-ink-soft"
                >
                  {t("dashboard.cancel")}
                </button>
                <button
                  onClick={createLocalUser}
                  disabled={creating || !newUsername.trim() || !newPassword}
                  className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl brand-gradient text-sm font-bold text-white disabled:opacity-40"
                >
                  {creating && <Loader2 className="h-4 w-4 animate-spin" />}
                  {t("auth.createLocalUser")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {users.some((u) => u.status === "pending") && (
        <div className="mb-6 space-y-3">
          <h2 className="flex items-center gap-1.5 text-sm font-bold text-amber">
            <Hourglass className="h-4 w-4" /> {t("auth.pendingSection")}
          </h2>
          {users.filter((u) => u.status === "pending").map((u) => (
            <div key={u.id} className="flex items-center gap-4 rounded-2xl border border-amber/20 bg-amber/5 p-4">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber/12 text-amber">
                <UserIcon className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="truncate font-bold text-ink">{u.username}</h3>
                <p className="text-xs text-ink-dim">
                  {t("auth.memberSince")} {new Date(u.createdAt).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={() => patch(u.id, { status: "approved" })}
                className="flex h-9 items-center gap-1.5 rounded-lg bg-ok/12 px-3 text-xs font-bold text-ok hover:bg-ok/20"
              >
                <Check className="h-3.5 w-3.5" /> {t("auth.approve")}
              </button>
              <button
                onClick={() => reject(u.id)}
                className="flex h-9 items-center gap-1.5 rounded-lg bg-down/12 px-3 text-xs font-bold text-down hover:bg-down/20"
              >
                <X className="h-3.5 w-3.5" /> {t("auth.reject")}
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-3">
        {users.filter((u) => u.status !== "pending").map((u) => (
          <div key={u.id} className="flex items-center gap-4 rounded-2xl glass p-4">
            <span className={cn(
              "flex h-11 w-11 items-center justify-center rounded-xl",
              u.role === "admin" ? "bg-brand/12 text-brand-glow" : "bg-cyan/12 text-cyan"
            )}>
              {u.role === "admin" ? <ShieldCheck className="h-5 w-5" /> : <UserIcon className="h-5 w-5" />}
            </span>
            <Link href={`/users/${u.id}`} className="min-w-0 flex-1">
              <h3 className="flex items-center gap-2 truncate font-bold text-ink">
                {u.username}
                {u.plexId ? (
                  <span className="rounded-full bg-amber/12 px-2 py-0.5 text-[10px] font-bold text-amber">Plex</span>
                ) : (
                  <span className="rounded-full bg-cyan/12 px-2 py-0.5 text-[10px] font-bold text-cyan">{t("auth.local")}</span>
                )}
                {u.canManageRequests && !("admin" === u.role) && (
                  <span className="rounded-full bg-cyan/12 px-2 py-0.5 text-[10px] font-bold text-cyan">{t("auth.delegated")}</span>
                )}
              </h3>
              <p className="text-xs text-ink-dim">
                {t("auth.memberSince")} {new Date(u.createdAt).toLocaleDateString()}
              </p>
            </Link>

            <div className="flex items-center gap-1 rounded-xl glass p-1">
              {(["user", "admin"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => patch(u.id, { role: r })}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                    u.role === r ? "brand-gradient text-white" : "text-ink-soft hover:text-ink"
                  )}
                >
                  {r === "admin" ? t("auth.admin") : t("auth.user")}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2" title={t("auth.autoApproveHint")}>
              <span className="hidden text-xs font-semibold text-ink-soft sm:inline">{t("auth.autoApprove")}</span>
              <Toggle on={u.autoApproveRequests} onChange={() => patch(u.id, { autoApproveRequests: !u.autoApproveRequests })} />
            </div>

            <Link
              href={`/users/${u.id}`}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg glass-strong text-ink-dim hover:text-ink"
            >
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange} className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", on ? "brand-gradient" : "bg-white/10")}>
      <span className={cn("absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform", on && "translate-x-5")} />
    </button>
  );
}
