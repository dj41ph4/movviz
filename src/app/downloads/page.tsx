import { redirect } from "next/navigation";

export default function DownloadsRedirect() {
  redirect("/activity?tab=downloads");
}
