import fs from 'node:fs';
const read=(p)=>fs.readFileSync(p,'utf8');
const write=(p,s)=>fs.writeFileSync(p,s,'utf8');
const must=(c,m)=>{if(!c)throw new Error(m)};
const rep=(s,a,b,m)=>{must(s.includes(a),`missing ${m}`);return s.replace(a,b)};

// Shared Android repository (used by TV and mobile): both fallback levels are
// now Movviz FFmpeg raw-source routes. Plex may provide original bytes, never
// its transcoder/MDE.
{
  const p='android-tv/app/src/main/kotlin/com/movviz/tv/data/MovvizRepository.kt';
  let s=read(p);
  const a=`    fun transcodeUrl(plexRatingKey: String): String = "$baseUrl/api/stream/$plexRatingKey/transcode?tv=0&ta=1&fmt=dash"`;
  const b=`    fun transcodeUrl(plexRatingKey: String): String = "$baseUrl/api/playback-ffmpeg/$plexRatingKey"`;
  s=rep(s,a,b,'android audio fallback url');
  const c=`    fun transcodeFullUrl(plexRatingKey: String): String = "$baseUrl/api/stream/$plexRatingKey/transcode?tv=1&ta=1"`;
  const d=`    fun transcodeFullUrl(plexRatingKey: String, audioStreamID: String? = null): String {\n        val audio = audioStreamID?.let { "&audioStreamID=$it" } ?: ""\n        return "$baseUrl/api/playback-ffmpeg/$plexRatingKey?quality=fhd$audio"\n    }`;
  s=rep(s,c,d,'android full fallback url');
  s=s.replace(/\/\*\* URL de repli quand le direct-play échoue[\s\S]*?fun transcodeUrl/, `/** Repli audio Movviz : source brute + FFmpeg, vidéo copiée bit-exacte et audio adaptée.\n     * Aucun endpoint Plex Transcoder/MDE n'est appelé. */\n    fun transcodeUrl`);
  s=s.replace(/\/\*\* Dernier recours après le repli audio-seul[\s\S]*?fun transcodeFullUrl/, `/** Repli vidéo Movviz : utilisé uniquement après détection MediaCodec réelle d'une vidéo non décodable.\n     * FFmpeg Movviz produit H.264/AAC en MP4 progressif ; Plex reste au plus une source d'octets bruts. */\n    fun transcodeFullUrl`);
  write(p,s);
}

for (const p of [
  'android-tv/app/src/main/kotlin/com/movviz/tv/ui/player/PlayerActivity.kt',
  'android-mobile/app/src/main/java/com/movviz/mobile/player/PlayerActivity.kt',
]) {
  let s=read(p);
  // Level 1 fallback: even when the preflight ffmpeg flag is stale/false, use
  // the same Movviz endpoint and let it return a truthful server error rather
  // than silently invoking Plex Transcoder.
  if (p.includes('android-tv')) {
    const old=`            1 -> if (level1FfmpegAvailable) {`;
    // Keep branch shape to reduce blast radius, but make its else progressive too.
    must(s.includes(old),'tv level1 anchor');
    s=s.replace(`                val url = repository.transcodeUrl(item.ratingKey)\n                Log.i(TAG, "load() repli audio DASH Plex: $url (resumeMs=$resumeMs)")\n                MediaItem.Builder()\n                    .setUri(url)\n                    .setMimeType(MimeTypes.APPLICATION_MPD)\n                    .setMediaMetadata(metadata)\n                    .build()`, `                val url = repository.transcodeUrl(item.ratingKey)\n                Log.i(TAG, "load() repli audio Movviz: $url (resumeMs=$resumeMs)")\n                MediaItem.Builder().setUri(url).setMediaMetadata(metadata).build()`);
    s=s.replace(`                val url = repository.transcodeFullUrl(item.ratingKey)\n                Log.i(TAG, "load() transcode complet HLS: $url (resumeMs=$resumeMs)")\n                MediaItem.Builder()\n                    .setUri(url)\n                    .setMimeType(MimeTypes.APPLICATION_M3U8)\n                    .setMediaMetadata(metadata)\n                    .build()`, `                val url = repository.transcodeFullUrl(item.ratingKey, level1AudioStreamId)\n                Log.i(TAG, "load() transcode vidéo Movviz: $url (resumeMs=$resumeMs)")\n                MediaItem.Builder().setUri(url).setMediaMetadata(metadata).build()`);
  } else {
    s=s.replace(`                val url = repository.transcodeUrl(item.ratingKey)\n                Log.i(TAG, "transcode audio-seul DASH: $url resume=$resumeMs")\n                MediaItem.Builder().setUri(url).setMimeType(MimeTypes.APPLICATION_MPD).setMediaMetadata(metadata).build()`, `                val url = repository.transcodeUrl(item.ratingKey)\n                Log.i(TAG, "transcode audio Movviz: $url resume=$resumeMs")\n                MediaItem.Builder().setUri(url).setMediaMetadata(metadata).build()`);
    s=s.replace(`                val url = repository.transcodeFullUrl(item.ratingKey)\n                Log.i(TAG, "transcode complet HLS: $url resume=$resumeMs")\n                MediaItem.Builder().setUri(url).setMimeType(MimeTypes.APPLICATION_M3U8).setMediaMetadata(metadata).build()`, `                val url = repository.transcodeFullUrl(item.ratingKey, level1AudioStreamId)\n                Log.i(TAG, "transcode vidéo Movviz: $url resume=$resumeMs")\n                MediaItem.Builder().setUri(url).setMediaMetadata(metadata).build()`);
  }
  // Stale prose must not claim the Plex transcoder is still a fallback.
  s=s.replaceAll('transcodage complet HLS h264/aac', 'transcodage vidéo Movviz h264/aac');
  s=s.replaceAll('transcodage complet HLS', 'transcodage vidéo Movviz');
  s=s.replaceAll('transcode Plex DASH historique', 'transcodeur Movviz');
  write(p,s);
}

// Clean the only stale PLEX_FALLBACK mention found by the release guard.
{
  const p='src/components/player/VideoPlayer.tsx';
  let s=read(p).replace('DIRECT_PLAY et PLEX_FALLBACK/UNSUPPORTED', 'DIRECT_PLAY et UNSUPPORTED');
  write(p,s);
}

// Android release invariant: there must be no client call to the historical
// /api/stream/{ratingKey}/transcode Plex endpoint.
for (const p of [
  'android-tv/app/src/main/kotlin/com/movviz/tv/data/MovvizRepository.kt',
  'android-tv/app/src/main/kotlin/com/movviz/tv/ui/player/PlayerActivity.kt',
  'android-mobile/app/src/main/java/com/movviz/mobile/player/PlayerActivity.kt',
]) {
  const s=read(p);
  must(!s.includes('/transcode?tv='), `${p}: Plex transcoder URL remains`);
}

fs.rmSync('scripts/v12404-android.mjs',{force:true});
console.log('Android TV/mobile now use Movviz-only transcoding fallbacks');
