"use client";

import { useState } from "react";
import { mutate as mutateGlobal } from "swr";
import { Check, Loader2 } from "lucide-react";
import { useT } from "@/i18n/provider";
import { useCurrentUser } from "@/lib/auth/useCurrentUser";

const FIELD = "h-11 rounded-xl border border-white/8 bg-black/30 px-3 text-sm text-ink outline-none focus:border-brand/40";
const ACTION = "mt-3 flex h-10 items-center gap-2 rounded-xl brand-gradient px-4 text-sm font-bold text-white disabled:opacity-40";

/**
 * Deux façons de se connecter à un même profil : un pseudo local (sans Plex) et le compte Plex.
 * Aucun nouvel utilisateur n'est créé : on renseigne le compte courant, donc l'historique, la liste,
 * les notes et les réglages restent exactement les mêmes quel que soit le mode de connexion.
 */
export function SignInMethodsPanel() {
  const t = useT();
  const user = useCurrentUser();
  const [username, setUsername] = useState(user?.username ?? "");
  const [password, setPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [localBusy, setLocalBusy] = useState(false);
  const [localMessage, setLocalMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [plexBusy, setPlexBusy] = useState(false);
  const [plexMessage, setPlexMessage] = useState<{ text: string; ok: boolean } | null>(null);
  if (!user) return null;

  const hasPassword = user.hasPassword;
  const trimmed = username.trim();
  const localReady = hasPassword
    ? trimmed.length >= 3 && currentPassword.length > 0 && (trimmed !== user.username || password.length >= 8)
    : trimmed.length >= 3 && password.length >= 8;

  const saveLocal = async () => {
    setLocalBusy(true);
    setLocalMessage(null);
    try {
      const res = await fetch("/api/profile/local-login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: trimmed, password, currentPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setLocalMessage({ text: t("profile.signin.saved"), ok: true });
        setPassword("");
        setCurrentPassword("");
        mutateGlobal("/api/auth/me");
        return;
      }
      const errors: Record<string, string> = {
        username_too_short: t("auth.usernameTooShort"),
        username_too_long: t("profile.signin.usernameTooLong"),
        username_taken: t("auth.usernameTaken"),
        password_too_short: t("auth.passwordTooShort"),
        wrong_password: t("profile.wrongPassword"),
      };
      setLocalMessage({ text: errors[data.error] ?? t("profile.signin.failed"), ok: false });
    } finally {
      setLocalBusy(false);
    }
  };

  const linkPlex = async () => {
    setPlexBusy(true);
    setPlexMessage(null);
    try {
      const pinRes = await fetch("/api/auth/plex/pin", { method: "POST" });
      const pin = await pinRes.json();
      if (!pinRes.ok) {
        setPlexMessage({ text: t("auth.plexUnreachable"), ok: false });
        return;
      }
      const authWindow = window.open(pin.authUrl, "_blank", "width=500,height=600");
      if (!authWindow || authWindow.closed) {
        setPlexMessage({ text: t("auth.plexPopupBlocked"), ok: false });
        return;
      }
      const deadline = Date.now() + 120_000;
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 2000));
        const pollRes = await fetch("/api/profile/plex-link/poll", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id: pin.id }),
        });
        const poll = await pollRes.json().catch(() => ({}));
        if (poll.done) {
          setPlexMessage({ text: t("profile.signin.plexLinked"), ok: true });
          mutateGlobal("/api/auth/me");
          return;
        }
        if (pollRes.status === 409) {
          setPlexMessage({ text: poll.error === "plex_already_linked" ? t("profile.signin.plexAlreadyLinked") : t("profile.signin.plexLinkedHint"), ok: false });
          return;
        }
      }
      setPlexMessage({ text: t("auth.plexTimeout"), ok: false });
    } finally {
      setPlexBusy(false);
    }
  };

  return (
    <>
      <div className="mb-6 rounded-2xl glass p-5">
        <h3 className="mb-1 text-base font-bold text-ink">{hasPassword ? t("profile.signin.localTitle") : t("profile.signin.localCreateTitle")}</h3>
        <p className="mb-4 text-[13px] leading-5 text-ink-dim">{hasPassword ? t("profile.signin.localHint") : t("profile.signin.localCreateHint")}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder={t("profile.signin.username")}
            autoComplete="username"
            maxLength={40}
            className={FIELD}
          />
          {hasPassword ? (
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder={t("profile.currentPassword")}
              autoComplete="current-password"
              className={FIELD}
            />
          ) : (
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("profile.signin.password")}
              autoComplete="new-password"
              className={FIELD}
            />
          )}
          {hasPassword && (
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("profile.signin.newPasswordOptional")}
              autoComplete="new-password"
              className={`${FIELD} sm:col-span-2`}
            />
          )}
        </div>
        <button onClick={saveLocal} disabled={localBusy || !localReady} className={ACTION}>
          {localBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : hasPassword ? t("profile.signin.save") : t("profile.signin.createLocal")}
        </button>
        {localMessage && <p className={`mt-2 text-xs ${localMessage.ok ? "text-ok" : "text-down"}`}>{localMessage.text}</p>}
      </div>

      <div className="mb-6 rounded-2xl glass p-5">
        <h3 className="mb-1 text-base font-bold text-ink">{t("profile.signin.plexTitle")}</h3>
        {user.plexId ? (
          <p className="flex items-center gap-2 text-[13px] leading-5 text-ink-dim">
            <Check className="h-4 w-4 shrink-0 text-ok" />
            {t("profile.signin.plexLinkedHint")}
          </p>
        ) : (
          <>
            <p className="mb-1 text-[13px] leading-5 text-ink-dim">{t("profile.signin.plexLinkHint")}</p>
            <button onClick={linkPlex} disabled={plexBusy} className={ACTION}>
              {plexBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : t("profile.signin.plexLink")}
            </button>
          </>
        )}
        {plexMessage && <p className={`mt-2 text-xs ${plexMessage.ok ? "text-ok" : "text-down"}`}>{plexMessage.text}</p>}
      </div>
    </>
  );
}
