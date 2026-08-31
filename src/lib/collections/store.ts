import fs from "node:fs";
import path from "node:path";
import type { Collection, CollectionItem } from "./types";
import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";

const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ??
  process.env.MOVVIZ_DATA_DIR ??
  path.join(process.cwd(), ".movviz-data");
const FILE = path.join(CONFIG_DIR, "collections.json");

interface CollectionsData {
  collections: Collection[];
}

function read(): CollectionsData {
  return readJsonCached<CollectionsData>(FILE, { collections: [] });
}

function write(data: CollectionsData) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  writeJsonCached(FILE, data);
}

export function loadCollections(): Collection[] {
  return read().collections;
}

export function saveCollection(collection: Collection): Collection {
  const data = read();
  const idx = data.collections.findIndex((c) => c.id === collection.id);
  if (idx >= 0) {
    data.collections[idx] = collection;
  } else {
    data.collections.push(collection);
  }
  write(data);
  return collection;
}

export function deleteCollection(id: string): void {
  const data = read();
  data.collections = data.collections.filter((c) => c.id !== id);
  write(data);
}

export function getCollection(id: string): Collection | undefined {
  return read().collections.find((c) => c.id === id);
}

export function addItemToCollection(collectionId: string, item: CollectionItem): void {
  const data = read();
  const collection = data.collections.find((c) => c.id === collectionId);
  if (collection) {
    if (!collection.items.some((i) => i.libraryRef === item.libraryRef)) {
      collection.items.push(item);
      write(data);
    }
  }
}

export function removeItemFromCollection(collectionId: string, libraryRef: string): void {
  const data = read();
  const collection = data.collections.find((c) => c.id === collectionId);
  if (collection) {
    collection.items = collection.items.filter((i) => i.libraryRef !== libraryRef);
    write(data);
  }
}

export function reorderItems(collectionId: string, items: CollectionItem[]): void {
  const data = read();
  const collection = data.collections.find((c) => c.id === collectionId);
  if (collection) {
    collection.items = items;
    write(data);
  }
}
