/**
 * Current-page context for the AI chat — lets the assistant know what the
 * user is looking at ("find me something in the same vein, darker") without
 * the chatbox having to guess from the URL. Written by the title detail
 * page, read by the chat widget, sent along with each chat request. This is
 * CLIENT-side state (browser tab), unlike the server's in-process stores.
 */
export interface PageTitleContext {
  tmdbId: number;
  type: "movie" | "series";
  title: string;
}

const g = globalThis as typeof globalThis & { __movvizPageContext?: PageTitleContext };

export function setPageTitleContext(ctx: PageTitleContext | null): void {
  g.__movvizPageContext = ctx ?? undefined;
}

export function getPageTitleContext(): PageTitleContext | null {
  return g.__movvizPageContext ?? null;
}