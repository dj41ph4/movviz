import type { Metadata } from "next";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  try {
    const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:9810";
    const res = await fetch(`${base}/api/metadata/person?id=${id}`);
    if (res.ok) {
      const data = await res.json();
      if (data?.name) return { title: data.name };
    }
  } catch { /* fallback */ }
  return { title: "Personne" };
}

export default function PersonLayout({ children }: { children: React.ReactNode }) {
  return children;
}
