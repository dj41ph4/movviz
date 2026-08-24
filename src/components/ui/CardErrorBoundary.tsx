"use client";

import { Component, type ReactNode } from "react";

interface CardErrorBoundaryProps {
  children: ReactNode;
}

interface CardErrorBoundaryState {
  hasError: boolean;
  hasRetried: boolean;
}

// Live-observed on the dashboard hero: React's commit phase throws
// "NotFoundError: Failed to execute 'removeChild' on 'Node'" when the
// YouTube IFrame API mutates the trailer embed's DOM at the same moment
// framer-motion's AnimatePresence is mid-exit-removal of the same subtree
// (the TrailerHeader now isolates that iframe DOM from React). A recovery
// may still help for a transient rendering error, but it must never
// continually unmount/remount a carousel when an underlying browser error
// persists.
const AUTO_RETRY_MS = 600;

/**
 * Scoped to a single carousel item (poster card, hero slide…) — one title
 * with bad/unexpected data (e.g. a malformed field from a specific TMDb
 * response) throwing during render used to bubble all the way up to
 * `app/error.tsx`, blanking the entire dashboard for one broken card among
 * dozens of working ones. This just drops the one card instead — matches
 * how a broken video tile behaves elsewhere in the app (skipped, not a
 * full-screen error) — then quietly retries once, see AUTO_RETRY_MS above.
 */
export class CardErrorBoundary extends Component<CardErrorBoundaryProps, CardErrorBoundaryState> {
  state: CardErrorBoundaryState = { hasError: false, hasRetried: false };
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  static getDerivedStateFromError(): Partial<CardErrorBoundaryState> {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("[CardErrorBoundary]", error);
    if (!this.state.hasRetried) {
      if (this.retryTimer) clearTimeout(this.retryTimer);
      this.retryTimer = setTimeout(() => this.setState({ hasError: false, hasRetried: true }), AUTO_RETRY_MS);
    }
  }

  componentWillUnmount() {
    if (this.retryTimer) clearTimeout(this.retryTimer);
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}
