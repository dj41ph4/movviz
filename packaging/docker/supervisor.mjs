import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";

export class RecoveryPolicy {
  constructor({ graceMs = 600_000, failureMs = 300_000, cooldownMs = 900_000 } = {}) {
    this.graceMs = graceMs;
    this.failureMs = failureMs;
    this.cooldownMs = cooldownMs;
    this.startedAt = 0;
    this.failedAt = null;
    this.lastRestart = -Infinity;
    this.restarts = [];
  }
  started(now) { this.startedAt = now; this.failedAt = null; }
  check(ok, now) {
    if (ok || now - this.startedAt < this.graceMs) { this.failedAt = null; return false; }
    this.failedAt ??= now;
    this.restarts = this.restarts.filter((t) => now - t < 3_600_000);
    return now - this.failedAt >= this.failureMs
      && now - this.lastRestart >= this.cooldownMs && this.restarts.length < 3;
  }
  restarted(now) { this.lastRestart = now; this.restarts.push(now); this.failedAt = null; }
}

export function supervise({ command = process.execPath, args = ["server.js"],
  url = `http://127.0.0.1:${process.env.PORT ?? process.env.MOVVIZ_WEB_PORT ?? 9810}/api/healthz`,
  intervalMs = 30_000, timeoutMs = 10_000, stopMs = 30_000,
  policy = new RecoveryPolicy() } = {}) {
  let child, stopping = false, checking = false, restarting = false, timer;
  const launch = () => {
    if (stopping) return;
    policy.started(Date.now());
    child = spawn(command, args, { stdio: "inherit", env: process.env });
    child.on("error", (error) => console.error("[watchdog] démarrage web échoué", error));
    child.once("close", (code, signal) => {
      if (stopping || restarting) return;
      const now = Date.now();
      policy.restarts = policy.restarts.filter((t) => now - t < 3_600_000);
      const delay = Math.max(60_000, policy.lastRestart + policy.cooldownMs - now,
        policy.restarts.length >= 3 ? policy.restarts[0] + 3_600_000 - now : 0);
      console.error(`[watchdog] serveur web arrêté (${code ?? signal}), relance dans ${Math.ceil(delay / 1000)} s`);
      timer = setTimeout(() => { policy.restarted(Date.now()); launch(); }, delay);
    });
  };
  const stopChild = () => new Promise((resolve) => {
    if (!child?.pid || child.exitCode !== null || child.signalCode !== null) return resolve();
    const target = child;
    const force = setTimeout(() => target.kill("SIGKILL"), stopMs);
    target.once("exit", () => { clearTimeout(force); resolve(); });
    target.kill("SIGTERM");
  });
  launch();
  const monitor = setInterval(async () => {
    if (checking || stopping || restarting || !child || child.exitCode !== null || child.signalCode !== null) return;
    checking = true;
    try {
      const ok = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) })
        .then((r) => r.ok).catch(() => false);
      if (policy.check(ok, Date.now()) && !stopping) {
        restarting = true;
        policy.restarted(Date.now());
        console.error("[watchdog] web indisponible durablement : redémarrage du serveur web uniquement");
        await stopChild();
        restarting = false;
        launch();
      }
    } finally { checking = false; }
  }, intervalMs);
  return async () => {
    stopping = true;
    clearInterval(monitor);
    clearTimeout(timer);
    await stopChild();
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const stop = supervise();
  for (const signal of ["SIGTERM", "SIGINT"]) {
    process.once(signal, () => void stop().then(() => process.exit(0)));
  }
}
