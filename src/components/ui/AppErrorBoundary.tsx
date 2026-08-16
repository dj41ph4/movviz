"use client";

import { Component, type ReactNode } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
}

/**
 * Last-resort client error boundary around the whole AppShell tree.
 *
 * React's commit phase (DOM mutations) is NOT covered by try/catch — a
 * "NotFoundError: Failed to execute 'removeChild' on 'Node'" thrown there
 * (e.g. an external lib like hls.js/dash.js/YouTube racing the unmount of a
 * framer-motion AnimatePresence child) used to bubble straight to Next's
 * default global-error screen, killing the whole session. This boundary
 * catches commit-phase errors and swaps the tree for a small recover screen;
 * "Réessayer" remounts everything fresh instead of showing a dead screen.
 * Deliberately NOT using the i18n provider — the tree that crashed may
 * contain the provider itself.
 */
export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("[AppErrorBoundary]", error);
  }

  private retry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
          <AlertTriangle className="h-12 w-12 text-down" />
          <h1 className="text-2xl font-bold text-ink">Erreur inattendue</h1>
          <p className="max-w-md text-sm text-ink-dim">
            Une erreur est survenue pendant l&rsquo;affichage. L&rsquo;application va repartir de
            z&eacute;ro apr&egrave;s ce r&eacute;essai.
          </p>
          <button
            onClick={this.retry}
            className="mt-4 inline-flex items-center gap-2 rounded-xl brand-gradient px-5 py-2.5 text-sm font-bold text-white transition-transform hover:scale-105"
          >
            <RotateCw className="h-4 w-4" />
            R&eacute;essayer
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}