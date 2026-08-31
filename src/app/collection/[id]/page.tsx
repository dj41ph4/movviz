"use client";

import { useParams } from "next/navigation";
import { useTitlePanel } from "@/components/title/useTitlePanel";
import { CollectionContent } from "@/components/title/CollectionContent";

export default function CollectionPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const { titlePanel } = useTitlePanel();

  return (
    <>
      <CollectionContent id={id} />
      {titlePanel}
    </>
  );
}