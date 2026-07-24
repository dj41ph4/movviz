import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Profil",
};

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return children;
}
