"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { LogOut, ShieldCheck, UserCog } from "lucide-react";
import { useCurrentUser } from "@/lib/auth/useCurrentUser";
import { useT } from "@/i18n/provider";

export function UserMenu() {
  const user = useCurrentUser();
  const router = useRouter();
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  if (!user) return null;

  const initials = user.username.slice(0, 2).toUpperCase();
  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-xl glass py-1.5 pl-1.5 pr-3 transition-colors hover:border-brand/30"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-lg brand-gradient text-xs font-black text-white">
          {initials}
        </span>
        <span className="hidden text-sm font-semibold text-ink sm:block">{user.username}</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="absolute right-0 top-12 z-50 w-48 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl glass-strong p-1.5 shadow-2xl sm:w-56"
          >
            <div className="flex items-center gap-2 px-3 py-2 text-xs text-ink-dim">
              <ShieldCheck className="h-3.5 w-3.5 text-brand-glow" />
              {user.role === "admin" ? t("auth.admin") : t("auth.user")}
            </div>
            <Link
              href="/profile"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-ink-soft transition-colors hover:bg-white/5"
            >
              <UserCog className="h-4 w-4" /> {t("profile.title")}
            </Link>
            <button
              onClick={logout}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-down transition-colors hover:bg-down/10"
            >
              <LogOut className="h-4 w-4" /> {t("auth.logout")}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
