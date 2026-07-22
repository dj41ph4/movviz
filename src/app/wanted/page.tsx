import { redirect } from "next/navigation";

export default function WantedRedirect() {
  redirect("/library?tab=wanted");
}
