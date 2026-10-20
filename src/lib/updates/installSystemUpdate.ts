/** Shared by manual buttons and the opt-in automatic trigger. Success means
 * the requested version actually answers, not merely that a job was queued. */
export async function installSystemUpdate(automatic = false): Promise<void> {
  const response = await fetch("/api/system/update", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ automatic }), signal: AbortSignal.timeout(30_000),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error ?? `HTTP ${response.status}`);
  if (!result.accepted) return; // Native Linux keeps its existing update path.
  const startedAt = Date.now();
  const deadline = startedAt + 40 * 60_000;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    let failure: string | undefined;
    try {
      const progressResponse = await fetch("/api/system/update?progress=1", { cache: "no-store", signal: AbortSignal.timeout(5000) });
      if (progressResponse.ok) {
        const progress = await progressResponse.json();
        if (progress.status === "error" && progress.version === result.version && Date.parse(progress.updatedAt) >= startedAt - 1000) {
          failure = progress.error ?? "update_failed";
        }
        if (progress.status === "complete" && progress.version === result.version) {
          const health = await fetch("/api/healthz", { cache: "no-store", signal: AbortSignal.timeout(5000) });
          const running = await health.json();
          if (health.ok && running.ok && running.version === result.version) {
            window.location.reload();
            return;
          }
        }
      }
    } catch { /* The web service is expected to be offline during install. */ }
    if (failure) throw new Error(failure);
  }
  throw new Error("update_timeout: check MovvizUpdater setup logs");
}
