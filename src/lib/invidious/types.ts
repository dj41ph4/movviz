export interface InvidiousFormat {
  url: string;
  itag: string;
  type: string;
  quality: string;
  qualityLabel?: string;
  width?: number;
  height?: number;
  fps?: number;
  bitrate?: number;
  initStart?: number;
  initEnd?: number;
  indexStart?: number;
  indexEnd?: number;
}

export interface InvidiousStreamsResponse {
  title?: string;
  adaptiveFormats: InvidiousFormat[];
  formatStreams: InvidiousFormat[];
}
