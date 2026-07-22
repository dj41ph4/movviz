import type { SlackConfig } from "../types";

export function sendSlack(cfg: SlackConfig, message: string): Promise<boolean> {
  if (!cfg.enabled || !cfg.webhookUrl) return Promise.resolve(false);
  return fetch(cfg.webhookUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text: `*Movviz* — ${message}` }),
  }).then((r) => r.ok).catch(() => false);
}
