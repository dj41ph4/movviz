import { redirect } from "next/navigation";

export default function SeriesPage() {
  redirect("/library?type=series");
}
