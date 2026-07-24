"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useT } from "@/i18n/provider";
import { Trash2, Edit2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useShouldReduceMotion } from "@/lib/motion/useReduceMotion";
import type { Collection } from "@/lib/collections/types";

interface CollectionCardProps {
  collection: Collection;
  index?: number;
  onEdit?: (collection: Collection) => void;
  onDelete?: (id: string) => void;
}

export function CollectionCard({ collection, index = 0, onEdit, onDelete }: CollectionCardProps) {
  const t = useT();
  const reduceMotion = useShouldReduceMotion();
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

  const cascadeAnim = reduceMotion ? {} : {
    initial: { opacity: 0, y: 20, scale: 0.95 },
    animate: { opacity: 1, y: 0, scale: 1 },
    transition: { duration: 0.3, delay: Math.min(index * 0.05, 0.5) },
    whileHover: { scale: 1.03, y: -2, boxShadow: "0 0 25px rgba(168, 130, 255, 0.15)" },
    whileTap: { scale: 0.98 },
    style: { willChange: "transform" } as React.CSSProperties,
  };
  const btnSpring = reduceMotion ? {} : {
    whileTap: { scale: 0.95 },
    transition: { type: "spring" as const, stiffness: 400, damping: 17 },
  };

  return (
    <motion.div className="group relative overflow-hidden rounded-2xl glass-strong hover:glass-stronger transition" {...cascadeAnim}>
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
            <motion.button
              {...btnSpring}
              onClick={() => onEdit(collection)}
              className="flex items-center gap-2 rounded-lg bg-white/20 px-3 py-2 text-xs font-bold text-white hover:bg-white/30"
            >
              <Edit2 className="h-3 w-3" />
            </motion.button>
          )}
          {onDelete && (
            <motion.button
              {...btnSpring}
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-2 rounded-lg bg-down/20 px-3 py-2 text-xs font-bold text-down hover:bg-down/30 disabled:opacity-50"
            >
              <Trash2 className="h-3 w-3" />
            </motion.button>
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
            <motion.button {...btnSpring} onClick={() => onEdit(collection)} className="flex-1 h-10 flex items-center justify-center rounded-xl bg-white/10 border border-white/10 text-ink-soft active:bg-white/20">
              <Edit2 className="h-4 w-4" />
            </motion.button>
          )}
          {onDelete && (
            <motion.button {...btnSpring} onClick={handleDelete} disabled={deleting} className="flex-1 h-10 flex items-center justify-center rounded-xl bg-down/15 border border-down/20 text-down active:bg-down/25 disabled:opacity-50">
              <Trash2 className="h-4 w-4" />
            </motion.button>
          )}
        </div>
      )}
    </motion.div>
  );
}
