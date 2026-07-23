"use client";

import { useState } from "react";
import { useT } from "@/i18n/provider";
import { Trash2, Edit2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Collection } from "@/lib/collections/types";

interface CollectionCardProps {
  collection: Collection;
  onEdit?: (collection: Collection) => void;
  onDelete?: (id: string) => void;
}

export function CollectionCard({ collection, onEdit, onDelete }: CollectionCardProps) {
  const t = useT();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!onDelete) return;
    setDeleting(true);
    try {
      await fetch(`/api/collections/${collection.id}`, { method: "DELETE" });
      onDelete(collection.id);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="group relative overflow-hidden rounded-2xl glass-strong hover:glass-stronger transition">
      <div
        className="aspect-square bg-gradient-to-br from-brand-glow/20 to-purple/20 flex items-center justify-center"
        style={{
          backgroundImage: collection.posterPath ? `url(${collection.posterPath})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="absolute inset-0 bg-black/50 group-hover:bg-black/60 transition" />
        <div className="absolute inset-0 hidden lg:flex flex-col items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition">
          {onEdit && (
            <button
              onClick={() => onEdit(collection)}
              className="flex items-center gap-2 rounded-lg bg-white/20 px-3 py-2 text-xs font-bold text-white hover:bg-white/30"
            >
              <Edit2 className="h-3 w-3" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-2 rounded-lg bg-down/20 px-3 py-2 text-xs font-bold text-down hover:bg-down/30 disabled:opacity-50"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
        <div className="relative text-center">
          <p className="font-bold text-white">{collection.name}</p>
          <p className="text-xs text-white/70">{collection.items.length} {t("collections.items")}</p>
        </div>
      </div>
      {(onEdit || onDelete) && (
        <div className="mt-1.5 flex gap-1.5 lg:hidden">
          {onEdit && (
            <button onClick={() => onEdit(collection)} className="flex-1 h-10 flex items-center justify-center rounded-xl bg-white/10 border border-white/10 text-ink-soft active:bg-white/20">
              <Edit2 className="h-4 w-4" />
            </button>
          )}
          {onDelete && (
            <button onClick={handleDelete} disabled={deleting} className="flex-1 h-10 flex items-center justify-center rounded-xl bg-down/15 border border-down/20 text-down active:bg-down/25 disabled:opacity-50">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
