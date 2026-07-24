import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Série",
};

export default function LibrarySeriesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
