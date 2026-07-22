"use client";

import { useEffect, useState } from "react";
import { useT } from "@/i18n/provider";
import type { Collection } from "@/lib/collections/types";

interface CollectionDetailProps {
  collectionId: string;
}

export function CollectionDetail({ collectionId }: CollectionDetailProps) {
  const t = useT();
  const [collection, setCollection] = useState<Collection | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/collections/${collectionId}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.collection) setCollection(d.collection);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [collectionId]);

  if (loading) {
    return <div>{t("common.loading")}</div>;
  }

  if (!collection) {
    return <div>{t("collections.notFound")}</div>;
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-ink mb-2">{collection.name}</h1>
      {collection.description && <p className="text-ink-soft mb-4">{collection.description}</p>}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {collection.items.length === 0 ? (
          <div className="col-span-full text-center text-ink-dim">{t("collections.noItems")}</div>
        ) : (
          collection.items.map((item) => (
            <div key={item.libraryRef} className="rounded-xl glass p-2">
              <p className="text-xs text-ink-soft truncate">{item.libraryRef}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
