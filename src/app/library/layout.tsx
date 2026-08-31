import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Bibliothèque",
};

export default function LibraryLayout({ children }: { children: React.ReactNode }) {
  return children;
}
