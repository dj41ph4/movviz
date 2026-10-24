export default function DownloadsLoading() {
  return (
    <div className="nx-downloads-page mx-auto max-w-[1600px]" aria-busy="true">
      <div className="mb-8 space-y-3">
        <div className="h-3 w-24 rounded bg-white/10" />
        <div className="h-9 w-64 rounded-lg bg-white/10" />
      </div>
      <div className="mb-6 flex gap-2">
        {[80, 90, 80, 75].map((width, index) => <div key={index} className="h-10 rounded-lg bg-white/10" style={{ width }} />)}
      </div>
      <div className="gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-3">
          <div className="h-28 rounded-xl bg-white/5" />
          <div className="h-20 rounded-xl bg-white/5" />
        </div>
        <div className="mt-6 h-48 rounded-xl bg-white/5 lg:mt-0" />
      </div>
    </div>
  );
}
