export interface PipedStream {
  url: string;
  mimeType: string;
  codec: string | null;
  quality: string | null;
  width: number | null;
  height: number | null;
  bitrate: number | null;
  initStart: number | null;
  initEnd: number | null;
  indexStart: number | null;
  indexEnd: number | null;
  videoOnly: boolean;
}

export interface PipedStreamsResponse {
  title?: string;
  duration: number;
  dash: string | null;
  hls: string | null;
  audioStreams: PipedStream[];
  videoStreams: PipedStream[];
}
