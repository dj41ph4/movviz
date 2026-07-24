export default function GlobalLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 rounded-full border-[3px] border-white/10 border-t-brand-glow animate-spin" />
        <p className="text-sm text-ink-dim">Chargement…</p>
      </div>
    </div>
  );
}
