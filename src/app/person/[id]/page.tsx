"use client";

import { use as usePromise } from "react";
import { useTitlePanel } from "@/components/title/useTitlePanel";
import { PersonContent } from "@/components/title/PersonContent";

export default function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const { titlePanel } = useTitlePanel();

  return (
    <>
      <PersonContent id={id} />
      {titlePanel}
    </>
  );
}