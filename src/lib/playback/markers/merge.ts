import {
  PLAYBACK_MARKER_SOURCES,
  PLAYBACK_MARKER_TYPES,
  type PlaybackMarker,
  type PlaybackMarkerSource,
  type PlaybackMarkerType,
} from "./types.ts";

/**
 * Fusion multisource, appliquée à la LECTURE (jamais à l'écriture) : le store
 * garde ce que chaque source a trouvé, changer la priorité ou un réglage ne
 * demande donc aucune resynchronisation.
 *
 * Règle, PAR TYPE (récap / intro / générique / avant-première) : la source la
 * plus prioritaire qui possède au moins un marqueur de ce type l'emporte, et
 * on garde TOUS ses marqueurs de ce type (plusieurs blocs credits restent
 * distincts). On ne mélange jamais le début d'une source avec la fin d'une
 * autre dans un même type. Les types qu'une source ne fournit pas (Plex n'a
 * ni récap ni avant-première) sont comblés par les suivantes.
 */
export function mergeMarkers(
  markers: readonly PlaybackMarker[],
  priority: readonly PlaybackMarkerSource[] = PLAYBACK_MARKER_SOURCES,
  /** Ordre propre à un type, quand il diffère de l'ordre général. */
  typePriority: Partial<Record<PlaybackMarkerType, readonly PlaybackMarkerSource[]>> = {},
): PlaybackMarker[] {
  const out: PlaybackMarker[] = [];
  for (const type of PLAYBACK_MARKER_TYPES) {
    for (const source of typePriority[type] ?? priority) {
      const picked = markers.filter((m) => m.type === type && m.source === source);
      if (picked.length > 0) {
        out.push(...picked);
        break;
      }
    }
  }
  return out.sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);
}
