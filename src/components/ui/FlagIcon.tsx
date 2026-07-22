import type { Locale } from "@/i18n/config";

/**
 * Hand-drawn flag SVGs instead of Unicode flag emoji — regional indicator
 * emoji render as bare two-letter codes on Windows (no flag glyphs in the
 * system emoji font there), so relying on them silently breaks the language
 * switcher for a large chunk of desktop users.
 */
const FLAGS: Record<Locale, (props: { className?: string }) => React.JSX.Element> = {
  fr: FlagFr,
  en: FlagEn,
  it: FlagIt,
  nl: FlagNl,
  de: FlagDe,
};

export function FlagIcon({ locale, className }: { locale: Locale; className?: string }) {
  const Flag = FLAGS[locale];
  return <Flag className={className} />;
}

function FlagFr({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 30 20" className={className} aria-hidden="true">
      <rect width="30" height="20" fill="#ED2939" />
      <rect width="20" height="20" fill="#fff" />
      <rect width="10" height="20" fill="#002395" />
    </svg>
  );
}

function FlagEn({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 30 20" className={className} aria-hidden="true">
      <rect width="30" height="20" fill="#012169" />
      <path d="M0 0 30 20M30 0 0 20" stroke="#fff" strokeWidth="4" />
      <path d="M0 0 30 20M30 0 0 20" stroke="#C8102E" strokeWidth="1.6" />
      <path d="M15 0V20M0 10H30" stroke="#fff" strokeWidth="6.5" />
      <path d="M15 0V20M0 10H30" stroke="#C8102E" strokeWidth="4" />
    </svg>
  );
}

function FlagIt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 30 20" className={className} aria-hidden="true">
      <rect width="30" height="20" fill="#CE2B37" />
      <rect width="20" height="20" fill="#fff" />
      <rect width="10" height="20" fill="#009246" />
    </svg>
  );
}

function FlagNl({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 30 20" className={className} aria-hidden="true">
      <rect width="30" height="20" fill="#fff" />
      <rect width="30" height="6.67" fill="#AE1C28" />
      <rect width="30" height="6.67" y="13.33" fill="#21468B" />
    </svg>
  );
}

function FlagDe({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 30 20" className={className} aria-hidden="true">
      <rect width="30" height="6.67" fill="#000" />
      <rect width="30" height="6.67" y="6.67" fill="#D00" />
      <rect width="30" height="6.67" y="13.33" fill="#FFCE00" />
    </svg>
  );
}
