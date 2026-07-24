"use client";

import { useState } from "react";
import { useT } from "@/i18n/provider";
import type { Collection } from "@/lib/collections/types";

interface CollectionEditorProps {
  collection?: Collection;
  onSave?: (collection: Collection) => void;
  onCancel?: () => void;
}

export function CollectionEditor({ collection, onSave, onCancel }: CollectionEditorProps) {
  const t = useT();
  const [name, setName] = useState(collection?.name ?? "");
  const [description, setDescription] = useState(collection?.description ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const data = {
        id: collection?.id ?? `col_${Date.now().toString(36)}`,
        name,
        description,
        items: collection?.items ?? [],
        createdBy: collection?.createdBy ?? "admin",
        createdAt: collection?.createdAt ?? Date.now(),
      };

      const response = await fetch("/api/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (response.ok && onSave) {
        onSave(data);
      } else {
        const err = await response.json().catch(() => ({}));
        setError(err.error ?? t("common.error"));
      }
    } catch {
      setError(t("common.error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl glass p-6 space-y-4">
      <div>
        <label className="block text-sm font-semibold text-ink-dim mb-2">{t("collections.name")}</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("collections.namePlaceholder")}
          className="w-full rounded-xl bg-white/8 px-4 py-2.5 text-ink outline-none transition focus:ring-2 focus:ring-brand-glow/50"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-ink-dim mb-2">{t("collections.description")}</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t("collections.descriptionPlaceholder")}
          rows={3}
          className="w-full rounded-xl bg-white/8 px-4 py-2.5 text-ink outline-none transition focus:ring-2 focus:ring-brand-glow/50"
        />
      </div>

      {error && <p className="text-xs font-semibold text-down">{error}</p>}

      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className="flex-1 rounded-xl brand-gradient px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
        >
          {saving ? t("common.saving") : t("common.save")}
        </button>
        {onCancel && (
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl glass px-4 py-2.5 text-sm font-bold text-ink-soft hover:text-ink transition"
          >
            {t("common.cancel")}
          </button>
        )}
      </div>
    </div>
  );
}
