"use client";

import { Suspense } from "react";
import { useT } from "@/i18n/provider";
import { CollectionDetail } from "@/components/collections/CollectionDetail";

export default function CollectionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const t = useT();
  return (
    <Suspense fallback={<div>{t("common.loading")}</div>}>
      <CollectionDetailPageInner params={params} />
    </Suspense>
  );
}

async function CollectionDetailPageInner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CollectionDetail collectionId={id} />;
}
