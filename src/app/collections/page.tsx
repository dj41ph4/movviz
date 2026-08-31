import { redirect } from "next/navigation";

/**
 * Collections (Sagas + user-curated) moved into the Bibliothèque page as a
 * tab — see src/app/library/page.tsx's CollectionTab. This route stays only
 * so old bookmarks/links to /collections keep working.
 */
export default function CollectionsRedirect() {
  redirect("/library?tab=collection");
}
