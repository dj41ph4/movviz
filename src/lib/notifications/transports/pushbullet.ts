import type { PushbulletConfig } from "../types";

export function sendPushbullet(cfg: PushbulletConfig, message: string): Promise<boolean> {
  if (!cfg.enabled || !cfg.apiToken) return Promise.resolve(false);
  return fetch("https://api.pushbullet.com/v2/pushes", {
    method: "POST",
    headers: { "content-type": "application/json", "Access-Token": cfg.apiToken },
    body: JSON.stringify({ type: "note", title: "Movviz", body: message }),
  }).then((r) => r.ok).catch(() => false);
}
