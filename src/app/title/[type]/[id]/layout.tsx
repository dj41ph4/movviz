import type { Metadata } from "next";

interface Props {
  params: Promise<{ type: string; id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { type, id } = await params;
  try {
    const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:9810";
    const res = await fetch(`${base}/api/metadata/detail?type=${type}&tmdbId=${id}&lang=fr`);
    if (res.ok) {
      const data = await res.json();
      const title = data?.title ?? data?.name;
      if (title) return { title };
    }
  } catch { /* fallback */ }
  return { title: type === "movie" ? "Film" : "Série" };
}

export default function TitleDetailLayout({ children }: { children: React.ReactNode }) {
  return children;
}
