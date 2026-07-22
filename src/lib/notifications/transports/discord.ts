import type { DiscordConfig } from "../types";

export function sendDiscord(cfg: DiscordConfig, message: string): Promise<boolean> {
  if (!cfg.enabled || !cfg.webhookUrl) return Promise.resolve(false);
  return fetch(cfg.webhookUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      embeds: [{
        title: "Movviz",
        description: message,
        color: 0x3b82f6,
        timestamp: new Date().toISOString(),
      }],
    }),
  }).then((r) => r.ok).catch(() => false);
}
