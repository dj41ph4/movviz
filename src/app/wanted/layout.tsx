import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Recherchés",
};

export default function WantedLayout({ children }: { children: React.ReactNode }) {
  return children;
}
