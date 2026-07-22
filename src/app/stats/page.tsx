import { redirect } from "next/navigation";

export default function StatsRedirect() {
  redirect("/settings?tab=health");
}
