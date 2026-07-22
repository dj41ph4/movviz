export type NotificationKind =
  | "user_registered"
  | "user_approved"
  | "reconcile_issues"
  | "plex_sync_imported"
  | "plex_full_reconcile"
  | "library_item_deleted"
  | "request_approved"
  | "request_declined"
  | "import_movie_available"
  | "import_season_available"
  | "import_episode_available"
  | "import_series_available"
  | "grab_movie"
  | "grab_movie_upgrade"
  | "grab_episode";

export interface NotificationItem {
  id: string;
  kind: NotificationKind;
  /** Fixed-language fallback text — what gets sent to external webhooks
   *  (Discord, Telegram, …), which have no concept of a per-viewer locale.
   *  The in-app bell (NotificationBell.tsx) never reads this: it renders
   *  `kind` + `params` through the viewer's own t(), so the notification
   *  list actually follows each user's chosen language. */
  message: string;
  /** Structured values ('{title}', '{count}', …) for the in-app renderer to
   *  interpolate into notifications.messages.<kind> in the viewer's locale. */
  params?: Record<string, string | number>;
  href: string | null;
  read: boolean;
  createdAt: number;
}

export interface DiscordConfig {
  enabled: boolean;
  webhookUrl: string;
}

export interface TelegramConfig {
  enabled: boolean;
  botToken: string;
  chatId: string;
}

export interface GotifyConfig {
  enabled: boolean;
  serverUrl: string;
  appToken: string;
}

export interface SlackConfig {
  enabled: boolean;
  webhookUrl: string;
}

export interface PushbulletConfig {
  enabled: boolean;
  apiToken: string;
}

export interface NotificationTransportConfig {
  discord: DiscordConfig;
  telegram: TelegramConfig;
  gotify: GotifyConfig;
  slack: SlackConfig;
  pushbullet: PushbulletConfig;
}

export const DEFAULT_TRANSPORT_CONFIG: NotificationTransportConfig = {
  discord: { enabled: false, webhookUrl: "" },
  telegram: { enabled: false, botToken: "", chatId: "" },
  gotify: { enabled: false, serverUrl: "", appToken: "" },
  slack: { enabled: false, webhookUrl: "" },
  pushbullet: { enabled: false, apiToken: "" },
};
