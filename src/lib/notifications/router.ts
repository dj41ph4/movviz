import { loadTransportConfig } from "./config";
import { sendDiscord } from "./transports/discord";
import { sendTelegram } from "./transports/telegram";
import { sendGotify } from "./transports/gotify";
import { sendSlack } from "./transports/slack";
import { sendPushbullet } from "./transports/pushbullet";

export async function dispatchNotification(message: string) {
  const cfg = loadTransportConfig();
  const results = await Promise.allSettled([
    sendDiscord(cfg.discord, message),
    sendTelegram(cfg.telegram, message),
    sendGotify(cfg.gotify, message),
    sendSlack(cfg.slack, message),
    sendPushbullet(cfg.pushbullet, message),
  ]);
  return results.some((r) => r.status === "fulfilled" && r.value);
}

export async function testTransport(kind: string): Promise<boolean> {
  const msg = "🔔 Movviz — test notification";
  const cfg = loadTransportConfig();
  switch (kind) {
    case "discord": return sendDiscord(cfg.discord, msg);
    case "telegram": return sendTelegram(cfg.telegram, msg);
    case "gotify": return sendGotify(cfg.gotify, msg);
    case "slack": return sendSlack(cfg.slack, msg);
    case "pushbullet": return sendPushbullet(cfg.pushbullet, msg);
    default: return false;
  }
}
