import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Help",
  description: "Installing and using MOVVIZ.",
};

export default function HelpLayout({ children }: { children: React.ReactNode }) {
  return children;
}
