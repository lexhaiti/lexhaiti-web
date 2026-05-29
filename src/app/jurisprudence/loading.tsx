export default function Loading() {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      {/* Hero skeleton */}
      <div className="bg-primary dark:bg-slate-900 pt-28 pb-10 lg:pb-14 lg:pt-36">
        <div className="container">
          <div className="h-10 w-72 bg-white/10 rounded-lg animate-pulse mb-3" />
          <div className="h-5 w-96 max-w-full bg-white/5 rounded animate-pulse" />
        </div>
      </div>

      {/* Filter bar skeleton */}
      <div className="container py-8">
        <div className="h-20 rounded-2xl bg-slate-50 dark:bg-slate-900 animate-pulse" />
      </div>

      {/* Row skeletons */}
      <div className="container space-y-4 pb-12">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4"
          >
            <div className="flex justify-between">
              <div className="h-4 w-32 bg-slate-100 dark:bg-slate-800/60 rounded animate-pulse" />
              <div className="h-4 w-24 bg-slate-100 dark:bg-slate-800/60 rounded animate-pulse" />
            </div>
            <div className="h-6 w-3/4 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
            <div className="flex gap-2">
              <div className="h-6 w-20 bg-slate-100 dark:bg-slate-800/60 rounded-full animate-pulse" />
              <div className="h-6 w-24 bg-slate-100 dark:bg-slate-800/60 rounded-full animate-pulse" />
              <div className="h-6 w-16 bg-slate-100 dark:bg-slate-800/60 rounded-full animate-pulse" />
            </div>
            <div className="flex justify-between border-t border-slate-100 dark:border-slate-800 pt-4">
              <div className="h-4 w-40 bg-slate-100 dark:bg-slate-800/60 rounded animate-pulse" />
              <div className="h-9 w-9 rounded-full bg-slate-100 dark:bg-slate-800/60 animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
