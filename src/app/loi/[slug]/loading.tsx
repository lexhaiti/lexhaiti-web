export default function Loading() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero skeleton */}
      <div className="bg-primary pt-28 pb-10 lg:pb-14 lg:pt-36">
        <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-10">
          <div className="h-4 w-40 bg-white/10 rounded animate-pulse mb-4" />
          <div className="h-9 w-[480px] max-w-full bg-white/10 rounded-lg animate-pulse mb-3" />
          <div className="h-5 w-72 bg-white/5 rounded animate-pulse" />
        </div>
      </div>
      {/* Content skeleton — two-column layout */}
      <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-10 py-8">
        <div className="flex gap-8">
          {/* Table of contents sidebar */}
          <div className="hidden lg:block w-64 flex-shrink-0 space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-4 bg-slate-100 rounded animate-pulse"
                style={{ width: `${60 + Math.random() * 40}%` }}
              />
            ))}
          </div>
          {/* Article body */}
          <div className="flex-1 min-w-0 space-y-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <div className="h-6 w-48 bg-slate-200 rounded animate-pulse" />
                <div className="space-y-2">
                  <div className="h-4 w-full bg-slate-100 rounded animate-pulse" />
                  <div className="h-4 w-full bg-slate-100 rounded animate-pulse" />
                  <div className="h-4 w-3/4 bg-slate-100 rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
