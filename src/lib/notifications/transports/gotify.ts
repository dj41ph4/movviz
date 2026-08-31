import type { GotifyConfig } from "../types";

export function sendGotify(cfg: GotifyConfig, message: string): Promise<boolean> {
  if (!cfg.enabled || !cfg.serverUrl || !cfg.appToken) return Promise.resolve(false);
  const url = `${cfg.serverUrl.replace(/\/+$/, "")}/message`;
  return fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", "X-Gotify-Key": cfg.appToken },
    body: JSON.stringify({ title: "Movviz", message, priority: 5 }),
  }).then((r) => r.ok).catch(() => false);
}
