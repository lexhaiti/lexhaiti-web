// Shared loading skeleton for the law-detail page. Used by BOTH the
// Next.js route-level ``loading.tsx`` (shown during the RSC navigation /
// streaming window) AND the client ``LawDetail`` component's own
// ``isLoading`` branch (shown while ``useLawDetail`` fetches after
// hydration).
//
// Keeping the two in lock-step — and shaping the hero skeleton to match
// the REAL ``LawHero`` band — is a CLS fix. The client component used to
// render a single centered full-screen spinner, which threw away the
// page's above-the-fold shape; when the data resolved, the full page
// (dark hero band + two-column body) replaced the empty spinner and the
// whole layout reflowed. That document-level reflow was the dominant
// layout-shift contributor on this route (CLS ≈ 0.37 on a slow load).
//
// The hero skeleton below mirrors ``LawHero``'s structure block-for-block
// — the 80px fixed-header offset, ``container py-12 lg:py-20`` padding,
// breadcrumb, status pill, the very large title, description, a metadata
// row with icon tiles, and theme chips — so its rendered height tracks
// the real hero's (~685px at desktop) instead of being a short stub.
// Matching the height is what keeps the content below from jumping when
// the skeleton is swapped for the loaded page.
export function LawDetailSkeleton() {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      {/* Hero band — mirrors LawHero's dark band + internal block rhythm
          so the reserved height matches the loaded hero. */}
      <div className="relative bg-primary dark:bg-slate-900 overflow-hidden border-b border-white/5 dark:border-slate-800">
        {/* 80px fixed-header offset — identical to LawHero. */}
        <div aria-hidden className="h-20" />
        <div className="relative z-10 container py-12 lg:py-20">
          {/* Breadcrumb */}
          <div className="mb-8 h-4 w-64 max-w-full bg-white/10 rounded animate-pulse" />

          <div className="flex flex-col gap-8 lg:gap-10">
            {/* 1. Status pill + official number */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="h-7 w-28 bg-white/10 rounded-full animate-pulse" />
              <div className="h-7 w-36 bg-white/5 rounded-full animate-pulse" />
            </div>

            {/* 2. Title + description — the title block is the tall one
                (lg:text-6xl in the real hero, two lines on most texts). */}
            <div className="flex flex-col gap-6 lg:gap-8">
              <div className="space-y-3">
                <div className="h-10 lg:h-14 w-[90%] bg-white/10 rounded-lg animate-pulse" />
                <div className="h-10 lg:h-14 w-[60%] bg-white/10 rounded-lg animate-pulse" />
              </div>
              <div className="space-y-2">
                <div className="h-5 w-full max-w-2xl bg-white/5 rounded animate-pulse" />
                <div className="h-5 w-3/4 max-w-xl bg-white/5 rounded animate-pulse" />
              </div>
            </div>

            {/* 3. Metadata row — icon tile + two text lines, repeated. */}
            <div className="flex flex-wrap items-center gap-x-8 gap-y-5">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="h-11 w-11 bg-white/5 rounded-full border border-white/10 animate-pulse" />
                  <div className="space-y-1.5">
                    <div className="h-2.5 w-16 bg-white/10 rounded animate-pulse" />
                    <div className="h-3.5 w-24 bg-white/10 rounded animate-pulse" />
                  </div>
                </div>
              ))}
            </div>

            {/* 4. Theme chips */}
            <div className="flex flex-wrap items-center gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-6 w-20 bg-white/5 rounded-full animate-pulse"
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Content skeleton — two-column layout matching the loaded body. */}
      <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-10 py-8">
        <div className="flex gap-8">
          {/* Table of contents sidebar */}
          <div className="hidden lg:block w-64 flex-shrink-0 space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-4 bg-slate-100 dark:bg-slate-800/60 rounded animate-pulse"
                // Deterministic widths (no Math.random) so server + client
                // render identical markup — a hydration mismatch here would
                // itself trigger a re-render shift.
                style={{ width: `${95 - i * 6}%` }}
              />
            ))}
          </div>
          {/* Article body */}
          <div className="flex-1 min-w-0 space-y-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <div className="h-6 w-48 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
                <div className="space-y-2">
                  <div className="h-4 w-full bg-slate-100 dark:bg-slate-800/60 rounded animate-pulse" />
                  <div className="h-4 w-full bg-slate-100 dark:bg-slate-800/60 rounded animate-pulse" />
                  <div className="h-4 w-3/4 bg-slate-100 dark:bg-slate-800/60 rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
