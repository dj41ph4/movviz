"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { ContinentPicker } from "@/components/discover/ContinentPicker";
import { useT } from "@/i18n/provider";
import { useCurrentUser } from "@/lib/auth/useCurrentUser";
import { cn } from "@/lib/utils";
import type { PublicUser } from "@/lib/auth/types";
import { ArrowLeft, ShieldCheck, User as UserIcon, ShieldAlert, Loader2, KeyRound } from "lucide-react";

const TABS = [
  { id: "general", labelKey: "auth.tabGeneral" },
  { id: "permissions", labelKey: "auth.tabPermissions" },
  { id: "password", labelKey: "auth.tabPassword" },
] as const;

export default function UserDetailPage() {
  const t = useT();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const currentUser = useCurrentUser();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("general");
  const [saving, setSaving] = useState(false);

  const load = () =>
    fetch(`/api/users/${params.id}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then(setUser);

  useEffect(() => { load(); }, [params.id]);

  const patch = async (body: Record<string, unknown>) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/users/${params.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) setUser(await res.json());
    } finally {
      setSaving(false);
    }
  };

  if (currentUser && currentUser.role !== "admin") {
    return (
      <div className="mx-auto flex max-w-[800px] flex-col items-center gap-3 rounded-2xl glass py-24 text-center">
        <ShieldAlert className="h-8 w-8 text-down" />
        <p className="font-semibold text-ink">{t("auth.restricted")}</p>
        <p className="text-sm text-ink-dim">{t("auth.restrictedHint")}</p>
      </div>
    );
  }

  if (!user) return (
    <div className="mx-auto max-w-[800px] animate-pulse">
      <div className="h-8 w-1/3 rounded bg-white/10" />
      <div className="mt-6 space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-20 rounded-2xl bg-white/5" />
        ))}
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-[800px]">
      <button
        onClick={() => router.push("/users")}
        className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-ink-dim hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> {t("auth.users")}
      </button>

      <PageHeader
        eyebrow={new Date(user.createdAt).toLocaleDateString()}
        title={user.username}
        description={user.role === "admin" ? t("auth.admin") : t("auth.user")}
      >
        <span className={cn(
          "flex h-11 w-11 items-center justify-center rounded-xl",
          user.role === "admin" ? "bg-brand/12 text-brand-glow" : "bg-cyan/12 text-cyan"
        )}>
          {user.role === "admin" ? <ShieldCheck className="h-5 w-5" /> : <UserIcon className="h-5 w-5" />}
        </span>
      </PageHeader>

      <div className="mb-6 flex items-center gap-1 rounded-xl glass p-1">
        {TABS.filter((tb) => tb.id !== "password" || !user.plexId).map((tb) => (
          <button
            key={tb.id}
            onClick={() => setTab(tb.id)}
            className={cn(
              "flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
              tab === tb.id ? "brand-gradient text-white" : "text-ink-soft hover:text-ink"
            )}
          >
            {t(tb.labelKey)}
          </button>
        ))}
      </div>

      {tab === "general" && (
        <GeneralTab user={user} onPatch={patch} saving={saving} />
      )}
      {tab === "permissions" && (
        <PermissionsTab user={user} onPatch={patch} saving={saving} isSelf={user.id === currentUser?.id} />
      )}
      {tab === "password" && !user.plexId && (
        <PasswordTab userId={user.id} />
      )}
    </div>
  );
}

function GeneralTab({
  user,
  onPatch,
  saving,
}: {
  user: PublicUser;
  onPatch: (body: Record<string, unknown>) => void;
  saving: boolean;
}) {
  const t = useT();
  const movieUnlimited = user.requestLimitMovies == null;
  const seriesUnlimited = user.requestLimitSeries == null;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl glass p-5">
        <h3 className="mb-1 text-sm font-bold text-ink-soft">{t("profile.discover")}</h3>
        <p className="mb-4 text-xs text-ink-dim">{t("profile.discoverHint")}</p>
        <ContinentPicker
          selected={user.discoverContinents ?? []}
          onChange={(next) => onPatch({ discoverContinents: next })}
        />
      </div>

      <div className="rounded-2xl glass p-5">
        <h3 className="mb-4 text-sm font-bold text-ink-soft">{t("auth.requestLimits")}</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <LimitField
            label={t("auth.requestLimitMovies")}
            value={user.requestLimitMovies}
            unlimited={movieUnlimited}
            onChange={(v) => onPatch({ requestLimitMovies: v })}
          />
          <LimitField
            label={t("auth.requestLimitSeries")}
            value={user.requestLimitSeries}
            unlimited={seriesUnlimited}
            onChange={(v) => onPatch({ requestLimitSeries: v })}
          />
        </div>
      </div>

      <div className="rounded-2xl glass p-5">
        <h3 className="mb-4 text-sm font-bold text-ink-soft">{t("auth.requestBehavior")}</h3>
        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-sm font-semibold text-ink">{t("auth.autoApprove")}</p>
            <p className="text-xs text-ink-dim">{t("auth.autoApproveHint")}</p>
          </div>
          <Toggle on={user.autoApproveRequests} onChange={() => onPatch({ autoApproveRequests: !user.autoApproveRequests })} />
        </div>
        {user.plexId && (
          <div className={cn("flex items-center justify-between py-2", !user.hasPlexToken && "opacity-40")}>
            <div>
              <p className="text-sm font-semibold text-ink">{t("plex.watchlistSync")}</p>
              <p className="text-xs text-ink-dim">
                {user.hasPlexToken ? t("plex.watchlistSyncHint") : t("plex.watchlistSyncNeedsOwnLogin")}
              </p>
            </div>
            <Toggle
              on={user.autoRequestFromWatchlist}
              onChange={() => user.hasPlexToken && onPatch({ autoRequestFromWatchlist: !user.autoRequestFromWatchlist })}
            />
          </div>
        )}
      </div>
      {saving && <Loader2 className="h-4 w-4 animate-spin text-ink-dim" />}
    </div>
  );
}

function LimitField({
  label,
  value,
  unlimited,
  onChange,
}: {
  label: string;
  value: number | null;
  unlimited: boolean;
  onChange: (v: number | null) => void;
}) {
  const t = useT();
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold text-ink-soft">{label}</p>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={0}
          disabled={unlimited}
          value={unlimited ? "" : (value ?? 0)}
          onChange={(e) => onChange(Math.max(0, Number(e.target.value)))}
          className="h-10 w-20 rounded-xl border border-white/8 bg-black/30 px-3 text-sm text-ink outline-none focus:border-brand/40 disabled:opacity-40"
        />
        <label className="flex items-center gap-1.5 text-xs font-medium text-ink-dim">
          <input
            type="checkbox"
            checked={unlimited}
            onChange={(e) => onChange(e.target.checked ? null : 0)}
          />
          {t("auth.unlimited")}
        </label>
      </div>
    </div>
  );
}

function PermissionsTab({
  user,
  onPatch,
  saving,
  isSelf,
}: {
  user: PublicUser;
  onPatch: (body: Record<string, unknown>) => void;
  saving: boolean;
  isSelf: boolean;
}) {
  const t = useT();
  return (
    <div className="space-y-6">
      <div className="rounded-2xl glass p-5">
        <h3 className="mb-4 text-sm font-bold text-ink-soft">{t("auth.role")}</h3>
        <div className="flex items-center gap-1 rounded-xl glass p-1">
          {(["user", "admin"] as const).map((r) => (
            <button
              key={r}
              disabled={isSelf && r === "user"}
              onClick={() => onPatch({ role: r })}
              className={cn(
                "flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors disabled:opacity-40",
                user.role === r ? "brand-gradient text-white" : "text-ink-soft hover:text-ink"
              )}
            >
              {r === "admin" ? t("auth.admin") : t("auth.user")}
            </button>
          ))}
        </div>
        {isSelf && <p className="mt-2 text-xs text-ink-dim">{t("auth.cannotDemoteSelf")}</p>}
      </div>

      <div className="rounded-2xl glass p-5">
        <div className={cn("flex items-center justify-between", user.role === "admin" && "opacity-40")}>
          <div>
            <p className="text-sm font-semibold text-ink">{t("auth.canManageRequests")}</p>
            <p className="text-xs text-ink-dim">{t("auth.canManageRequestsHint")}</p>
          </div>
          <Toggle
            on={user.role === "admin" || user.canManageRequests}
            onChange={() => user.role !== "admin" && onPatch({ canManageRequests: !user.canManageRequests })}
          />
        </div>
      </div>
      {saving && <Loader2 className="h-4 w-4 animate-spin text-ink-dim" />}
    </div>
  );
}

function PasswordTab({ userId }: { userId: string }) {
  const t = useT();
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const reset = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/users/${userId}/password`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ newPassword }),
      });
      if (res.ok) {
        setMessage(t("auth.passwordResetDone"));
        setNewPassword("");
      } else {
        setMessage(t("auth.passwordTooShort"));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl glass p-5">
      <h3 className="mb-1 flex items-center gap-2 text-sm font-bold text-ink-soft">
        <KeyRound className="h-4 w-4" /> {t("auth.resetPassword")}
      </h3>
      <p className="mb-4 text-xs text-ink-dim">{t("auth.resetPasswordHint")}</p>
      <div className="flex gap-2">
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder={t("profile.newPassword")}
          autoComplete="new-password"
          className="h-10 flex-1 rounded-xl border border-white/8 bg-black/30 px-3 text-sm text-ink outline-none focus:border-brand/40"
        />
        <button
          onClick={reset}
          disabled={saving || newPassword.length < 8}
          className="flex h-10 items-center gap-2 rounded-xl brand-gradient px-4 text-sm font-bold text-white disabled:opacity-40"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t("auth.resetPassword")}
        </button>
      </div>
      {message && <p className="mt-2 text-xs text-ink-dim">{message}</p>}
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
