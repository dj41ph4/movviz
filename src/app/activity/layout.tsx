import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Activité",
};

export default function ActivityLayout({ children }: { children: React.ReactNode }) {
  return children;
}
