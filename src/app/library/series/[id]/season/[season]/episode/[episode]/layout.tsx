import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Épisode",
};

export default function EpisodeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
