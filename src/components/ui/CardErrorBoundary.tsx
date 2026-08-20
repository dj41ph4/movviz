"use client";

import { Component, type ReactNode } from "react";

interface CardErrorBoundaryProps {
  children: ReactNode;
}

interface CardErrorBoundaryState {
  hasError: boolean;
}

/**
 * Scoped to a single carousel item (poster card, hero slide…) — one title
 * with bad/unexpected data (e.g. a malformed field from a specific TMDb
 * response) throwing during render used to bubble all the way up to
 * `app/error.tsx`, blanking the entire dashboard for one broken card among
 * dozens of working ones. This just drops the one card silently instead —
 * matches how a broken video tile behaves elsewhere in the app (skipped,
 * not a full-screen error).
 */
export class CardErrorBoundary extends Component<CardErrorBoundaryProps, CardErrorBoundaryState> {
  state: CardErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): CardErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("[CardErrorBoundary]", error);
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}
