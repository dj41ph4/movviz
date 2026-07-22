/**
 * Small hand-drawn marks for the external "view on ..." links on a title
 * page — simplified evocations of each brand's real mark (same spirit as
 * FlagIcon.tsx: no external asset/CDN dependency, just inline SVG).
 */

function PlexIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="8" fill="#E5A00D" />
      <path d="M11 8h4.2l6.8 8-6.8 8H11l6.8-8L11 8z" fill="#1A1A1A" />
    </svg>
  );
}

function TmdbIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="8" fill="#01B4E4" />
      <circle cx="13" cy="16" r="6.5" fill="#0D253F" />
      <circle cx="20.5" cy="16" r="4" fill="#90CEA1" />
    </svg>
  );
}

function ImdbIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="8" fill="#F5C518" />
      <text x="16" y="21" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="800" fontSize="11" fill="#000000">IMDb</text>
    </svg>
  );
}

function RottenTomatoesIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="8" fill="#0B1622" />
      <path d="M14 13c0-2 2-3 3.5-1.5" stroke="#3BA55D" strokeWidth="2" strokeLinecap="round" fill="none" />
      <circle cx="16" cy="19" r="7" fill="#FA320A" />
    </svg>
  );
}

function LetterboxdIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="8" fill="#14181C" />
      <circle cx="12" cy="16" r="6" fill="#00E054" />
      <circle cx="20" cy="16" r="6" fill="#40BCF4" />
      <circle cx="16" cy="16" r="6" fill="#FF8000" fillOpacity="0.85" />
    </svg>
  );
}

const BRAND_ICONS = {
  plex: PlexIcon,
  tmdb: TmdbIcon,
  imdb: ImdbIcon,
  rottenTomatoes: RottenTomatoesIcon,
  letterboxd: LetterboxdIcon,
} as const;

export type BrandName = keyof typeof BRAND_ICONS;

export function BrandIcon({ name, className }: { name: BrandName; className?: string }) {
  const Icon = BRAND_ICONS[name];
  return <Icon className={className} />;
}
