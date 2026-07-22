export interface CollectionItem {
  libraryRef: string;
  addedAt: number;
  addedBy: string;
  order?: number;
}

export interface Collection {
  id: string;
  name: string;
  description?: string;
  posterPath?: string;
  backdropPath?: string;
  tmdbCollectionId?: number;
  items: CollectionItem[];
  createdBy: string;
  createdAt: number;
  tags?: string[];
}
