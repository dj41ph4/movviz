import type { TelegramConfig } from "../types";

export function sendTelegram(cfg: TelegramConfig, message: string): Promise<boolean> {
  if (!cfg.enabled || !cfg.botToken || !cfg.chatId) return Promise.resolve(false);
  const url = `https://api.telegram.org/bot${cfg.botToken}/sendMessage`;
  return fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: cfg.chatId, text: `*Movviz*\n${message}`, parse_mode: "Markdown" }),
  }).then((r) => r.ok).catch(() => false);
}
