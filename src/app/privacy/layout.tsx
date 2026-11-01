import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How MOVVIZ stores and shares data.",
};

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
