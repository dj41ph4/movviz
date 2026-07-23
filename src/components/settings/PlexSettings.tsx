"use client";

import { useEffect, useState } from "react";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import { Check, X, Loader2, LinkIcon, RefreshCw, User } from "lucide-react";
import { useBetaPlayer } from "@/lib/settings/useBetaPlayer";

interface PlexConfig {
  hostname: string;
  port: number;
  useSsl: boolean;
  connected: boolean;
  syncLibrary: boolean;
  watchlistSyncEnabled: boolean;
}

export function PlexSettings() {
  const t = useT();
  const { enabled: betaPlayer, streamCacheTtl, setEnabled: setBetaPlayer, setStreamCacheTtl } = useBetaPlayer();
  const [cfg, setCfg] = useState<PlexConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<boolean | null>(null);
  const [linking, setLinking] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ moviesAdded: number; moviesMatched: number; seriesAdded: number; seriesMatched: number } | null>(null);

  const load = () =>
    fetch("/api/plex/config", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setCfg(d));

  useEffect(() => { load(); }, []);

  const save = async (patch: Partial<PlexConfig>) => {
    if (!cfg) return;
    const next = { ...cfg, ...patch };
    setCfg(next);
    setSaving(true);
    try {
      await fetch("/api/plex/config", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(next),
      });
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/plex/test", { method: "POST" });
      const d = await res.json();
      setTestResult(!!d.ok);
    } finally {
      setTesting(false);
    }
  };

  /**
   * The admin is already signed in here, so this uses its own poll endpoint
   * (/api/plex/link/poll) instead of the login one — the login flow requires
   * the Plex account to already be a friend of a connected server, which is
   * exactly the chicken-and-egg problem when connecting Plex for the first
   * time. This one just stores the token and links the current admin.
   */
  const link = async () => {
    setLinking(true);
    try {
      const pinRes = await fetch("/api/auth/plex/pin", { method: "POST" });
      const pin = await pinRes.json();
      if (!pinRes.ok) return;
      window.open(pin.authUrl, "_blank", "noopener,noreferrer");

      const deadline = Date.now() + 120_000;
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 2000));
        const pollRes = await fetch("/api/plex/link/poll", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id: pin.id }),
        });
        const poll = await pollRes.json();
        if (poll.done) {
          await load();
          break;
        }
      }
    } finally {
      setLinking(false);
    }
  };

  const syncNow = async (force = false) => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/plex/library-sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ force }),
      });
      if (res.ok) setSyncResult(await res.json());
    } finally {
      setSyncing(false);
    }
  };

  if (!cfg) return null;

  return (
    <div className="rounded-2xl glass p-5">
      <p className="mb-4 text-sm text-ink-dim">{t("plex.intro")}</p>

      <div className="mb-4 flex items-center gap-2">
        <span className={cn("flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold", cfg.connected ? "border-ok/25 bg-ok/12 text-ok" : "border-amber/25 bg-amber/12 text-amber")}>
          {cfg.connected ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
          {cfg.connected ? t("plex.connected") : t("plex.notLinked")}
        </span>
        <button
          onClick={link}
          disabled={linking}
          className="flex h-9 items-center gap-2 rounded-xl brand-gradient px-3.5 text-xs font-bold text-white disabled:opacity-50"
        >
          {linking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LinkIcon className="h-3.5 w-3.5" />}
          {cfg.connected ? t("plex.relink") : t("plex.link")}
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <input
          value={cfg.hostname}
          onChange={(e) => setCfg({ ...cfg, hostname: e.target.value })}
          onBlur={() => save({ hostname: cfg.hostname })}
          placeholder={t("plex.hostname")}
          className="h-11 rounded-xl border border-white/8 bg-black/30 px-3 text-sm text-ink outline-none focus:border-brand/40"
        />
        <input
          value={cfg.port}
          onChange={(e) => setCfg({ ...cfg, port: Number(e.target.value.replace(/\D/g, "")) || 0 })}
          onBlur={() => save({ port: cfg.port })}
          placeholder="32400"
          className="h-11 w-28 rounded-xl border border-white/8 bg-black/30 px-3 text-sm text-ink outline-none focus:border-brand/40"
        />
        <label className="flex h-11 items-center gap-2 rounded-xl border border-white/8 bg-black/30 px-3 text-sm text-ink-soft">
          <input type="checkbox" checked={cfg.useSsl} onChange={(e) => save({ useSsl: e.target.checked })} />
          SSL
        </label>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={test}
          disabled={testing}
          className="flex h-9 items-center gap-2 rounded-xl glass-strong px-3.5 text-xs font-semibold text-ink-soft disabled:opacity-50"
        >
          {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          {t("indexerMgr.test")}
        </button>
        {testResult != null && (
          <span className={cn("text-xs font-semibold", testResult ? "text-ok" : "text-down")}>
            {testResult ? t("indexerMgr.testOk") : t("indexerMgr.testFail")}
          </span>
        )}
        {saving && <span className="text-xs text-ink-dim">{t("settings.saved")}</span>}
      </div>

      {cfg.connected && (
        <div className="mt-5 border-t border-white/8 pt-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-ink">{t("plex.syncLibrary")}</p>
              <p className="text-xs text-ink-dim">{t("plex.syncLibraryHint")}</p>
            </div>
            <Toggle on={cfg.syncLibrary} onChange={() => save({ syncLibrary: !cfg.syncLibrary })} />
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={() => syncNow(false)}
              disabled={syncing}
              className="flex h-9 items-center gap-2 rounded-xl glass-strong px-3.5 text-xs font-semibold text-ink-soft disabled:opacity-50"
            >
              {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              {t("plex.syncNow")}
            </button>
            <button
              onClick={() => syncNow(true)}
              disabled={syncing}
              title={t("plex.fullRescanHint")}
              className="flex h-9 items-center gap-2 rounded-xl px-3.5 text-xs font-semibold text-ink-dim hover:text-ink disabled:opacity-50"
            >
              {t("plex.fullRescan")}
            </button>
            {syncResult && (
              <span className="text-xs text-ink-dim">
                {t("plex.syncResult", {
                  moviesAdded: syncResult.moviesAdded,
                  moviesMatched: syncResult.moviesMatched,
                  seriesAdded: syncResult.seriesAdded,
                  seriesMatched: syncResult.seriesMatched,
                })}
              </span>
            )}
          </div>
        </div>
      )}

      {cfg.connected && (
        <div className="mt-5 border-t border-white/8 pt-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-ink">{t("plex.watchlistSyncGlobal")}</p>
              <p className="text-xs text-ink-dim">{t("plex.watchlistSyncGlobalHint")}</p>
            </div>
            <Toggle on={cfg.watchlistSyncEnabled} onChange={() => save({ watchlistSyncEnabled: !cfg.watchlistSyncEnabled })} />
          </div>
        </div>
      )}

      {cfg.connected && <ProfilePicker />}

      <div className="mt-5 border-t border-white/8 pt-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-ink">{t("player.betaToggle")}</p>
            <p className="text-xs text-ink-dim">{t("player.betaToggleHint")}</p>
          </div>
          <Toggle on={betaPlayer} onChange={() => setBetaPlayer(!betaPlayer)} disabled={!cfg.connected} />
        </div>
        {betaPlayer && (
          <div className="mt-3 flex items-center gap-2">
            <label className="text-xs text-ink-dim">Cache segment :</label>
            <input
              type="number"
              min={0}
              max={86400}
              value={streamCacheTtl}
              onChange={(e) => setStreamCacheTtl(parseInt(e.target.value) || 0)}
              className="h-8 w-20 rounded-lg border border-white/8 bg-black/30 px-2 text-xs text-ink outline-none focus:border-brand/40"
            />
            <span className="text-xs text-ink-dim">secondes (0 = pas de cache)</span>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Allow the admin to assign each Movviz user to a specific Plex managed user
 * (profile), so watch status reflects that profile's viewing history.
 */
function ProfilePicker() {
  const t = useT();
  const [homeUsers, setHomeUsers] = useState<{ id: string; title: string; thumb: string | null }[]>([]);
  const [movvizUsers, setMovvizUsers] = useState<{ id: string; username: string; plexManagedUserId: string | null }[]>([]);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);

  const load = () => {
    Promise.all([
      fetch("/api/plex/home-users").then((r) => r.ok ? r.json() : { users: [] }),
      fetch("/api/users").then((r) => r.ok ? r.json() : { users: [] }),
    ]).then(([home, movviz]) => {
      setHomeUsers(home.users ?? []);
      setMovvizUsers(movviz.users ?? []);
    });
  };

  useEffect(() => { load(); }, []);

  const assign = async (userId: string, plexManagedUserId: string) => {
    setSavingUserId(userId);
    setMovvizUsers((prev) => prev.map((u) => u.id === userId ? { ...u, plexManagedUserId } : u));
    try {
      await fetch("/api/plex/assign-profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId, plexManagedUserId }),
      });
    } finally {
      setSavingUserId(null);
    }
  };

  const remove = async (userId: string) => {
    setSavingUserId(userId);
    setMovvizUsers((prev) => prev.map((u) => u.id === userId ? { ...u, plexManagedUserId: null } : u));
    try {
      await fetch("/api/plex/assign-profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId, plexManagedUserId: null }),
      });
    } finally {
      setSavingUserId(null);
    }
  };

  if (homeUsers.length === 0) return null;

  return (
    <div className="mt-5 border-t border-white/8 pt-5">
      <p className="mb-3 text-sm font-semibold text-ink">{t("plex.profiles")}</p>
      <p className="mb-4 text-xs text-ink-dim">{t("plex.profilesHint")}</p>
      <div className="space-y-2">
        {movvizUsers.map((u) => {
          const current = homeUsers.find((h) => h.id === u.plexManagedUserId);
          return (
            <div key={u.id} className="flex items-center gap-3 rounded-xl glass px-3 py-2">
              <User className="h-4 w-4 shrink-0 text-ink-soft" />
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{u.username}</span>
              <select
                value={u.plexManagedUserId ?? ""}
                onChange={(e) => {
                  if (e.target.value) assign(u.id, e.target.value);
                  else remove(u.id);
                }}
                disabled={savingUserId === u.id}
                className="h-8 max-w-[200px] rounded-lg border border-white/8 bg-black/30 px-2 text-xs text-ink outline-none focus:border-brand/40"
              >
                <option value="">—</option>
                {homeUsers.map((h) => (
                  <option key={h.id} value={h.id}>{h.title}</option>
                ))}
              </select>
              {savingUserId === u.id && <Loader2 className="h-3.5 w-3.5 animate-spin text-ink-dim" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Toggle({ on, onChange, disabled }: { on: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button onClick={onChange} disabled={disabled} className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", on && !disabled ? "brand-gradient" : "bg-white/10", disabled && "cursor-not-allowed opacity-40")}>
      <span className={cn("absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform", on && "translate-x-5")} />
    </button>
  );
}
