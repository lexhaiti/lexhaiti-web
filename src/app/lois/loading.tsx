export default function Loading() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero skeleton */}
      <div className="bg-primary pt-28 pb-10 lg:pb-14 lg:pt-36">
        <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-10">
          <div className="h-10 w-72 bg-white/10 rounded-lg animate-pulse mb-3" />
          <div className="h-5 w-96 max-w-full bg-white/5 rounded animate-pulse" />
        </div>
      </div>
      {/* Filter bar skeleton */}
      <div className="border-b border-slate-100 bg-slate-50/50">
        <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-10 py-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="h-10 w-64 bg-slate-200 rounded-lg animate-pulse" />
            <div className="h-10 w-32 bg-slate-100 rounded-lg animate-pulse" />
            <div className="h-10 w-32 bg-slate-100 rounded-lg animate-pulse" />
          </div>
        </div>
      </div>
      {/* Grid skeleton */}
      <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-10 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 9 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-slate-200 p-5 space-y-3"
            >
              <div className="h-4 w-20 bg-slate-100 rounded animate-pulse" />
              <div className="h-5 w-full bg-slate-200 rounded animate-pulse" />
              <div className="h-4 w-3/4 bg-slate-100 rounded animate-pulse" />
              <div className="flex gap-2 pt-1">
                <div className="h-6 w-16 bg-slate-100 rounded-full animate-pulse" />
                <div className="h-6 w-20 bg-slate-100 rounded-full animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
