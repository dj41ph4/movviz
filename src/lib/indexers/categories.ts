/**
 * Torznab/Newznab category tree — the public protocol's standard numbered
 * taxonomy (same ids on every compliant indexer), split into the two groups
 * Movviz actually cares about: movies and TV. Selecting a parent implies
 * "everything under it"; individual subcategories can still be picked for a
 * narrower search.
 */

export interface CategoryNode {
  id: number;
  name: string;
  children?: { id: number; name: string }[];
}

export const MOVIE_CATEGORIES: CategoryNode = {
  id: 2000,
  name: "Movies",
  children: [
    { id: 2010, name: "Foreign" },
    { id: 2020, name: "Other" },
    { id: 2030, name: "SD" },
    { id: 2040, name: "HD" },
    { id: 2045, name: "UHD" },
    { id: 2050, name: "BluRay" },
    { id: 2060, name: "3D" },
    { id: 2070, name: "DVD" },
    { id: 2080, name: "WEB-DL" },
    { id: 2090, name: "x265" },
  ],
};

export const MOVIE_CATEGORY_IDS = [MOVIE_CATEGORIES.id, ...MOVIE_CATEGORIES.children!.map((c) => c.id)];

export const TV_CATEGORIES: CategoryNode = {
  id: 5000,
  name: "TV",
  children: [
    { id: 5010, name: "WEB-DL" },
    { id: 5020, name: "Foreign" },
    { id: 5030, name: "SD" },
    { id: 5040, name: "HD" },
    { id: 5045, name: "UHD" },
    { id: 5050, name: "Other" },
    { id: 5060, name: "Sport" },
    { id: 5070, name: "Anime" },
    { id: 5080, name: "Documentary" },
    { id: 5090, name: "x265" },
  ],
};

export const TV_CATEGORY_IDS = [TV_CATEGORIES.id, ...TV_CATEGORIES.children!.map((c) => c.id)];
