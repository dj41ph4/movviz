"use client";

import { useState } from "react";
import useSWR from "swr";
import { PageHeader } from "@/components/ui/PageHeader";
import { useT } from "@/i18n/provider";
import { useCurrentUser } from "@/lib/auth/useCurrentUser";
import { relativeTime } from "@/lib/utils";
import { Key, Copy, Check, Trash2, Loader2, Plus, Star, X, Film, Tv, Sun, Moon, MonitorSmartphone } from "lucide-react";
import { ContinentPicker } from "@/components/discover/ContinentPicker";
import { mutate as mutateGlobal } from "swr";
import Link from "next/link";
import type { WatchlistItem } from "@/lib/watchlist/types";
import { useTheme } from "@/lib/theme/useTheme";
import { cn } from "@/lib/utils";
import type { ThemeMode } from "@/lib/theme/theme";

interface TokenRecord {
  id: string;
  name: string;
  createdAt: number;
  lastUsedAt: number | null;
}

const THEME_OPTIONS: { id: ThemeMode; icon: typeof Sun; labelKey: string }[] = [
  { id: "light", icon: Sun, labelKey: "profile.themeLight" },
  { id: "dark", icon: Moon, labelKey: "profile.themeDark" },
  { id: "auto", icon: MonitorSmartphone, labelKey: "profile.themeAuto" },
];

export default function ProfilePage() {
  const t = useT();
  const user = useCurrentUser();
  const { mode: themeMode, setThemeMode } = useTheme();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [pwMessage, setPwMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [tokenName, setTokenName] = useState("");
  const [freshToken, setFreshToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [creating, setCreating] = useState(false);

  const [continents, setContinents] = useState<string[] | null>(null);
  const [savingDiscover, setSavingDiscover] = useState(false);
  const [discoverMessage, setDiscoverMessage] = useState<string | null>(null);

  // Cached by SWR: instant paint on revisit, background revalidation.
  const { data: tokensData, mutate: mutateTokens } = useSWR<{ tokens: TokenRecord[] }>("/api/profile/tokens");
  const tokens = tokensData?.tokens ?? [];
  const loadTokens = () => mutateTokens();

  const [watchlistBusy, setWatchlistBusy] = useState<string | null>(null);
  const { data: watchlistData, mutate: mutateWatchlist } = useSWR<{ items: WatchlistItem[] }>("/api/watchlist");
  const watchlistItems = watchlistData?.items ?? [];
  const removeFromWatchlist = async (item: WatchlistItem) => {
    await fetch(`/api/watchlist/${item.type}/${item.tmdbId}`, { method: "DELETE" });
    mutateWatchlist();
  };
  const addWatchlistToLibrary = async (item: WatchlistItem) => {
    const key = `${item.type}:${item.tmdbId}`;
    setWatchlistBusy(key);
    try {
      const endpoint = item.type === "movie" ? "/api/library/movies" : "/api/library/series";
      await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tmdbId: item.tmdbId }),
      });
      await removeFromWatchlist(item);
    } finally {
      setWatchlistBusy(null);
    }
  };

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
  const activeContinents = continents ?? user.discoverContinents ?? [];

  const saveDiscover = async (next: string[]) => {
    setContinents(next);
    setSavingDiscover(true);
    setDiscoverMessage(null);
    try {
      await fetch("/api/profile/discover", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ continents: next }),
      });
      setDiscoverMessage(t("profile.discoverSaved"));
      mutateGlobal("/api/auth/me");
    } finally {
      setSavingDiscover(false);
    }
  };

  const changePassword = async () => {
    setSaving(true);
    setPwMessage(null);
    try {
      const res = await fetch("/api/profile/password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (res.ok) {
        setPwMessage(t("profile.passwordUpdated"));
        setCurrentPassword("");
        setNewPassword("");
      } else {
        const d = await res.json();
        setPwMessage(d.error === "wrong_password" ? t("profile.wrongPassword") : t("auth.passwordTooShort"));
      }
    } finally {
      setSaving(false);
    }
  };

  const createToken = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/profile/tokens", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: tokenName || "Token" }),
      });
      const d = await res.json();
      setFreshToken(d.token);
      setTokenName("");
      await loadTokens();
    } finally {
      setCreating(false);
    }
  };
  const revoke = async (id: string) => {
    await fetch(`/api/profile/tokens/${id}`, { method: "DELETE" });
    loadTokens();
  };
  const copyToken = async () => {
    if (!freshToken) return;
    await navigator.clipboard.writeText(freshToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="mx-auto max-w-[800px]">
      <PageHeader eyebrow={user.username} title={t("profile.title")} description={t("profile.description")} />

      <div className="mb-6 rounded-2xl glass p-5">
        <h3 className="mb-1 text-sm font-bold text-ink-soft">{t("profile.appearance")}</h3>
        <p className="mb-4 text-xs text-ink-dim">{t("profile.appearanceHint")}</p>
        <div className="flex flex-wrap gap-1.5">
          {THEME_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const active = themeMode === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => setThemeMode(opt.id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors ring-focus",
                  active ? "brand-gradient text-white shadow-lg" : "glass-strong text-ink-soft hover:text-ink"
                )}
              >
                <Icon className="h-4 w-4" />
                {t(opt.labelKey)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mb-6 rounded-2xl glass p-5">
        <h3 className="mb-4 text-sm font-bold text-ink-soft">{t("profile.changePassword")}</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder={t("profile.currentPassword")}
            className="h-11 rounded-xl border border-white/8 bg-black/30 px-3 text-sm text-ink outline-none focus:border-brand/40"
          />
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder={t("profile.newPassword")}
            className="h-11 rounded-xl border border-white/8 bg-black/30 px-3 text-sm text-ink outline-none focus:border-brand/40"
          />
        </div>
        <button
          onClick={changePassword}
          disabled={saving || !currentPassword || newPassword.length < 8}
          className="mt-3 flex h-10 items-center gap-2 rounded-xl brand-gradient px-4 text-sm font-bold text-white disabled:opacity-40"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t("profile.updatePassword")}
        </button>
        {pwMessage && <p className="mt-2 text-xs text-ink-dim">{pwMessage}</p>}
      </div>

      <div className="mb-6 rounded-2xl glass p-5">
        <h3 className="mb-1 text-sm font-bold text-ink-soft">{t("profile.discover")}</h3>
        <p className="mb-4 text-xs text-ink-dim">{t("profile.discoverHint")}</p>
        <ContinentPicker selected={activeContinents} onChange={saveDiscover} />
        {(savingDiscover || discoverMessage) && (
          <p className="mt-2 text-xs text-ink-dim">
            {savingDiscover ? <Loader2 className="inline h-3 w-3 animate-spin" /> : discoverMessage}
          </p>
        )}
      </div>

      <div className="mb-6 rounded-2xl glass p-5">
        <h3 className="mb-4 text-sm font-bold text-ink-soft">{t("watchlist.title")}</h3>
        <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {watchlistItems.map((item) => {
            const poster = item.posterPath ? `https://image.tmdb.org/t/p/w500${item.posterPath}` : null;
            const key = `${item.type}:${item.tmdbId}`;
            return (
              <article key={key} className="group w-full">
                <Link href={`/title/${item.type}/${item.tmdbId}`} className="relative block aspect-[2/3] overflow-hidden rounded-2xl border border-white/5 bg-surface">
                  {poster ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={poster} alt={item.title} loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      {item.type === "movie" ? <Film className="h-7 w-7 text-ink-soft/70" /> : <Tv className="h-7 w-7 text-ink-soft/70" />}
                    </div>
                  )}
                  <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/55 px-2 py-1 text-[11px] font-bold backdrop-blur">
                    <Star className="h-3 w-3 fill-amber text-amber" /> {item.rating.toFixed(1)}
                  </div>
                  <div className="absolute inset-0 flex flex-col justify-end gap-1.5 bg-gradient-to-t from-black/90 via-black/10 to-transparent p-3 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    <button
                      onClick={(e) => { e.preventDefault(); addWatchlistToLibrary(item); }}
                      disabled={watchlistBusy === key}
                      className="flex h-9 items-center justify-center gap-1.5 rounded-xl brand-gradient text-xs font-bold text-white"
                    >
                      {watchlistBusy === key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                      {t("watchlist.moveToLibrary")}
                    </button>
                    <button
                      onClick={(e) => { e.preventDefault(); removeFromWatchlist(item); }}
                      className="flex h-8 items-center justify-center gap-1.5 rounded-xl glass-strong text-xs font-semibold text-down"
                    >
                      <X className="h-3.5 w-3.5" /> {t("common.remove")}
                    </button>
                  </div>
                </Link>
                <h3 className="mt-2.5 truncate px-0.5 text-sm font-semibold text-ink">{item.title}</h3>
              </article>
            );
          })}
        </div>
        {watchlistItems.length === 0 && <p className="py-6 text-center text-sm text-ink-dim">{t("watchlist.empty")}</p>}
      </div>

      <div className="rounded-2xl glass p-5">
        <h3 className="mb-1 text-sm font-bold text-ink-soft">{t("profile.apiTokens")}</h3>
        <p className="mb-4 text-xs text-ink-dim">{t("profile.apiTokensHint")}</p>

        <div className="mb-4 flex gap-2">
          <input
            value={tokenName}
            onChange={(e) => setTokenName(e.target.value)}
            placeholder={t("profile.tokenName")}
            className="h-10 flex-1 rounded-xl border border-white/8 bg-black/30 px-3 text-sm text-ink outline-none focus:border-brand/40"
          />
          <button
            onClick={createToken}
            disabled={creating}
            className="flex h-10 items-center gap-2 rounded-xl brand-gradient px-4 text-sm font-bold text-white disabled:opacity-50"
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {t("profile.newToken")}
          </button>
        </div>

        {freshToken && (
          <div className="mb-4 rounded-xl border border-brand/30 bg-brand/8 p-3">
            <p className="mb-1.5 text-xs text-ink-dim">{t("profile.tokenCreatedHint")}</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate text-xs text-ink">{freshToken}</code>
              <button onClick={copyToken} className="flex h-8 w-8 items-center justify-center rounded-lg glass-strong text-ink-soft">
                {copied ? <Check className="h-3.5 w-3.5 text-ok" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          {tokens.map((tk) => (
            <div key={tk.id} className="flex items-center gap-3 rounded-xl border border-white/5 bg-black/20 px-3 py-2.5">
              <Key className="h-4 w-4 shrink-0 text-ink-dim" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">{tk.name}</p>
                <p className="text-[11px] text-ink-dim">
                  {relativeTime(new Date(tk.createdAt).toISOString())}
                  {tk.lastUsedAt ? ` · ${relativeTime(new Date(tk.lastUsedAt).toISOString())}` : ""}
                </p>
              </div>
              <button onClick={() => revoke(tk.id)} className="flex h-8 w-8 items-center justify-center rounded-lg glass-strong text-down">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {tokens.length === 0 && <p className="text-sm text-ink-dim">{t("profile.noTokens")}</p>}
        </div>
      </div>
    </div>
  );
}
