import type { fr } from "./locales/fr";

/**
 * The French dictionary is the source of truth: its shape defines the contract
 * every other locale must satisfy. `DeepReadonly` keeps the literal structure
 * while allowing any string value per key.
 */
type DeepStringify<T> = {
  [K in keyof T]: T[K] extends string ? string : DeepStringify<T[K]>;
};

export type Dictionary = DeepStringify<typeof fr>;
