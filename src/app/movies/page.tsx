import { redirect } from "next/navigation";

export default function MoviesPage() {
  redirect("/library?type=movie");
}
