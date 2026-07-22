"use client";

import { useEffect, useState } from "react";
import type { MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useT } from "@/i18n/provider";
import { AnimatedLogo } from "@/components/fx/AnimatedLogo";
import { Loader2, ShieldCheck, Play } from "lucide-react";

const cardVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.15 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 320, damping: 28 } },
};

export default function LoginPage() {
  const t = useT();
  const router = useRouter();
  const [setupRequired, setSetupRequired] = useState<boolean | null>(null);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [plexBusy, setPlexBusy] = useState(false);

  // Subtle cursor-driven 3D tilt on the login card.
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [7, -7]), { stiffness: 200, damping: 22 });
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-7, 7]), { stiffness: 200, damping: 22 });
  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    mouseX.set((e.clientX - rect.left) / rect.width - 0.5);
    mouseY.set((e.clientY - rect.top) / rect.height - 0.5);
  };
  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d.user) router.replace("/");
        setSetupRequired(d.setupRequired);
        setMode(d.setupRequired ? "register" : "login");
      });
  }, [router]);

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      const endpoint = mode === "register" ? "/api/auth/register" : "/api/auth/login";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(
          data.error === "username_taken" ? t("auth.usernameTaken")
          : data.error === "username_too_short" ? t("auth.usernameTooShort")
          : data.error === "password_too_short" ? t("auth.passwordTooShort")
          : t("auth.invalidCredentials")
        );
        return;
      }
      if (mode === "register") {
        // Only the very first account (setup) skips approval — everyone
        // registering after that lands on the "pending" screen instead.
        router.push(data.user?.status === "pending" ? "/" : "/setup");
      } else {
        router.push("/");
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const loginWithPlex = async () => {
    setError(null);
    setPlexBusy(true);
    try {
      const pinRes = await fetch("/api/auth/plex/pin", { method: "POST" });
      const pin = await pinRes.json();
      if (!pinRes.ok) {
        setError(t("auth.plexUnreachable"));
        setPlexBusy(false);
        return;
      }

      const authWindow = window.open(pin.authUrl, "_blank", "width=500,height=600");
      if (!authWindow || authWindow.closed) {
        setError(t("auth.plexPopupBlocked"));
        setPlexBusy(false);
        return;
      }

      const deadline = Date.now() + 120_000;
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 2000));
        const pollRes = await fetch("/api/auth/plex/poll", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id: pin.id }),
        });
        const poll = await pollRes.json();
        if (poll.done) {
          router.push(setupRequired ? "/setup" : "/");
          router.refresh();
          return;
        }
        if (pollRes.status === 403) {
          setError(t("auth.plexNoAccess"));
          return;
        }
      }
      setError(t("auth.plexTimeout"));
    } finally {
      setPlexBusy(false);
    }
  };

  if (setupRequired === null) return (
    <div className="flex min-h-screen items-center justify-center bg-void">
      <Loader2 className="h-8 w-8 animate-spin text-ink-dim" />
    </div>
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-void p-4" style={{ perspective: 1200 }}>
      <motion.div
        variants={cardVariants}
        initial="hidden"
        animate="show"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
        className="w-full max-w-sm rounded-2xl glass-strong p-8"
      >
        <motion.div variants={itemVariants} className="mb-6 flex flex-col items-center gap-3 text-center">
          <AnimatedLogo size="lg" />
          <h1 className="text-logo-flow text-2xl font-black tracking-tight">Movviz</h1>
          <p className="text-xs text-ink-dim">
            {setupRequired ? t("auth.setupTitle") : t("auth.welcomeTitle")}
          </p>
          {setupRequired && (
            <p className="flex items-center gap-1.5 text-xs text-ink-dim">
              <ShieldCheck className="h-3.5 w-3.5 text-brand-glow" /> {t("auth.setupHint")}
            </p>
          )}
        </motion.div>

        <motion.div variants={itemVariants} className="space-y-3">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-ink-soft">{t("auth.username")}</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              className="h-11 w-full rounded-xl border border-white/8 bg-black/30 px-3 text-sm text-ink outline-none focus:border-brand/40"
              autoFocus
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-ink-soft">{t("auth.password")}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              className="h-11 w-full rounded-xl border border-white/8 bg-black/30 px-3 text-sm text-ink outline-none focus:border-brand/40"
            />
          </div>

          {error && <p className="text-xs font-semibold text-down">{error}</p>}

          <button
            onClick={submit}
            disabled={busy || !username.trim() || !password}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl brand-gradient text-sm font-bold text-white disabled:opacity-40"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "register" ? t("auth.createAccount") : t("auth.login")}
          </button>

          <div className="flex items-center gap-3 py-1">
            <span className="h-px flex-1 bg-white/8" />
            <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-dim">{t("auth.or")}</span>
            <span className="h-px flex-1 bg-white/8" />
          </div>

          <button
            onClick={loginWithPlex}
            disabled={plexBusy}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl glass-strong text-sm font-bold text-amber disabled:opacity-40"
          >
            {plexBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 fill-amber" />}
            {t("auth.loginWithPlex")}
          </button>
        </motion.div>

        {!setupRequired && (
          <motion.button
            variants={itemVariants}
            onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(null); }}
            className="mt-4 w-full text-center text-xs text-ink-dim hover:text-ink-soft"
          >
            {mode === "login" ? t("auth.noAccount") : t("auth.haveAccount")}{" "}
            <span className="font-semibold text-brand-glow">
              {mode === "login" ? t("auth.switchToRegister") : t("auth.switchToLogin")}
            </span>
          </motion.button>
        )}
      </motion.div>
    </div>
  );
}
