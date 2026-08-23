/**
 * Phase 1 contracts (see PLAN_REFONTE_MOTEUR_LECTURE_MOVVIZ.md §10-13).
 * A `ClientPlaybackProfile` is what a client (desktop web, Android mobile,
 * Android TV, cast) reports about itself before asking for a stream — real
 * detected capabilities, never a static "Android TV = HEVC"-style guess.
 */

import type { HdrType } from "./mediaDescriptor";

export type ClientType = "desktop-web" | "android-mobile" | "android-tv" | "cast";

/**
 * Deliberately more than a boolean per codec: a client can decode HEVC in
 * general but not Main10 at 2160p60, for instance — the decision engine
 * needs that resolution, so "HEVC = true" isn't enough.
 */
export interface VideoCapability {
  codec: string;
  profiles?: string[];
  levels?: string[];
  bitDepths?: number[];
  maxWidth?: number;
  maxHeight?: number;
  maxFps?: number;
  hardwareDecode?: boolean;
  hdr?: HdrType[];
}

/**
 * `decode` (the client can decode this codec itself) and `passthrough`
 * (the client can hand it to the receiver/HDMI sink undecoded) are
 * different capabilities — an Android TV box is the clearest case where
 * they diverge.
 */
export interface AudioCapability {
  codec: string;
  maxChannels?: number;
  decode?: boolean;
  passthrough?: boolean;
}

export interface SubtitleCapability {
  codec: string;
  nativeRender?: boolean;
  externalSupported?: boolean;
  embeddedSupported?: boolean;
  convertible?: boolean;
}

export interface ClientPlaybackProfile {
  clientType: ClientType;
  deviceId: string;
  appVersion: string;

  protocols: {
    progressive: boolean;
    hls: boolean;
    dash: boolean;
    mse: boolean;
  };

  containers: string[];

  videoCapabilities: VideoCapability[];
  audioCapabilities: AudioCapability[];
  subtitleCapabilities: SubtitleCapability[];

  maxWidth?: number;
  maxHeight?: number;
  maxBitrate?: number;
}
