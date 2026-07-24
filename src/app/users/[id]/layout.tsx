import type { Metadata } from "next";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  try {
    const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:9810";
    const res = await fetch(`${base}/api/auth/users?id=${id}`);
    if (res.ok) {
      const data = await res.json();
      if (data?.username) return { title: data.username };
    }
  } catch { /* fallback */ }
  return { title: "Utilisateur" };
}

export default function UserDetailLayout({ children }: { children: React.ReactNode }) {
  return children;
}
