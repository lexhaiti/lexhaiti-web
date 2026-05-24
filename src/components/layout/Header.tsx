'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { ArrowRight, ChevronDown } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'

import { Button } from '@/components/ui/button'
import BrandLogo from '@/components/shared/BrandLogo'
import { useT } from '@/i18n/useT'
import { cn } from '@/lib/utils'
import { MENU_DATA } from '@/components/layout/menu'
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher'
import {
  AddTextButton,
  MobileUserSection,
  UserMenu,
} from '@/components/layout/UserMenu'
import { useSession } from 'next-auth/react'

// --- Utility: Check Active State ---
// Active when (a) the pathname matches, and (b) every query param the link
// declares matches the current URL. With a query, exact-match wins (so
// /lois?category=constitution highlights only CONSTITUTION). Without a
// query, the link is active only when NO discriminating filter is set —
// that way the bare "CODES & LOIS" doesn't ALSO highlight on a
// Constitution / Droit Fiscal / Récents view, since a more specific
// sibling owns that view.
//
// `theme`, `status`, and `sort` are included alongside category/sub-
// category because the megamenu has links scoped by all of them
// (Thématiques column, "Lois récentes" sort link, "Abrogées" status
// link). Without them, /lois?theme=droit_fiscal would highlight both
// the bare "CODES & LOIS" item AND the dedicated theme item.
const _DISCRIMINATING_PARAMS = [
  'category',
  'code_subcategory',
  'theme',
  'status',
  'sort',
] as const

function isPathActive(
  pathname: string | null,
  search: URLSearchParams | null,
  href: string,
) {
  if (!pathname) return false
  if (href === '/') return pathname === '/'
  const [hPath, hQuery] = href.split('?')
  if (!pathname.startsWith(hPath)) return false
  if (!hQuery) {
    return !_DISCRIMINATING_PARAMS.some((p) => search?.get(p))
  }
  const required = new URLSearchParams(hQuery)
  for (const [k, v] of required.entries()) {
    if (search?.get(k) !== v) return false
  }
  return true
}

// --- Animated Hamburger Icon ---
function AnimatedHamburger({ isOpen }: { isOpen: boolean }) {
  return (
    <div className="relative w-6 h-6 flex flex-col items-center justify-center gap-[5px]">
      <motion.span
        animate={isOpen ? { rotate: 45, y: 7 } : { rotate: 0, y: 0 }}
        className="w-6 h-0.5 bg-current rounded-full origin-center"
      />
      <motion.span
        animate={isOpen ? { opacity: 0, x: -10 } : { opacity: 1, x: 0 }}
        className="w-6 h-0.5 bg-current rounded-full"
      />
      <motion.span
        animate={isOpen ? { rotate: -45, y: -7 } : { rotate: 0, y: 0 }}
        className="w-6 h-0.5 bg-current rounded-full origin-center"
      />
    </div>
  )
}

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [activeMegaMenu, setActiveMegaMenu] = useState<string | null>(null)
  // Used by the mobile drawer to hide the "Connexion éditoriale" link
  // when the user is already signed in — that link only makes sense
  // for visitors; signed-in editors get the new MobileUserSection.
  const { status: authStatus } = useSession()
  const [scrolled, setScrolled] = useState(false)

  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { t } = useT()

  // Scroll detection
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const handleMegaMenuOpen = (labelKey: string) => setActiveMegaMenu(labelKey)
  const handleMegaMenuClose = () => setActiveMegaMenu(null)

  return (
    <>
      <motion.header
        className={cn(
          'fixed top-0 z-50 w-full transition-all duration-300',
          // 1. Enforce consistent height/padding so it doesn't narrow
          'h-20',

          // 2. On scroll, switch to a fully opaque white background.
          //
          // The previous behavior used a semi-transparent
          // `bg-white/85 backdrop-blur-md` glass effect, which looked
          // beautiful on bright pages but produced a muddy mid-blue
          // band when scrolled over the dark navy page headers
          // (`bg-primary` on /lois, /loi/[slug], /moniteur/[id], etc.):
          // the navy bled through the 15% transparency and clashed with
          // the white text the header otherwise needs to hold.
          // Solid white avoids that boundary problem at the cost of a
          // touch less polish — worth the trade since the dark headers
          // are the most common landing surfaces.
          scrolled ? 'bg-white shadow-sm' : 'bg-white',
        )}
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Permanent red gradient — visual brand spine that anchors the header
            and merges seamlessly with the megamenu's own top accent when open. */}
        <div className="absolute bottom-0 left-0 w-full h-0.5 bg-gradient-to-r from-red-500 via-red-600 to-red-500" />

        <div className="container h-full flex items-center justify-between">
          {/* 1. LOGO (Always Visible) */}
          {/* 1. LOGO (Always Visible) */}
          <div className="flex-shrink-0 z-20 relative">
            <BrandLogo
              titleClassName="text-slate-900 font-extrabold text-2xl tracking-tighter"
              taglineClassName=" text-[10px] font-bold uppercase tracking-widest mt-0.5"
              // Uses the BrandLogo default size (48px mobile / 56px
              // from sm+) — no override needed. Slightly bigger than
              // the pre-emblem brand mark; gives the new engraved
              // detail room to read at iPhone glance distance.
              showTagline={true}
              taglineKey={t('nav.logoTagline')}
            />
          </div>

          {/* 2. DESKTOP NAVIGATION */}
          <nav
            className="hidden xl:flex items-center gap-6 mx-8 h-full"
            onMouseLeave={handleMegaMenuClose}
          >
            {MENU_DATA.map((item, index) => (
              <div
                key={index}
                className="h-full flex items-center"
                onMouseEnter={() =>
                  item.type === 'megamenu' && handleMegaMenuOpen(item.labelKey)
                }
              >
                {/* Main Nav Links */}
                <Link
                  href={item.href || '#'}
                  className={cn(
                    'group relative flex items-center gap-1 text-sm font-bold uppercase tracking-wide transition-colors h-full',
                    isPathActive(pathname, searchParams, item.href!) ||
                      activeMegaMenu === item.labelKey
                      ? 'text-red-600'
                      : 'text-slate-800 hover:text-red-600',
                  )}
                >
                  {t(item.labelKey)}
                  {item.type === 'megamenu' && (
                    <ChevronDown
                      className={cn(
                        'h-3 w-3 transition-transform duration-200',
                        activeMegaMenu === item.labelKey
                          ? 'rotate-180'
                          : 'opacity-50',
                      )}
                    />
                  )}
                </Link>
              </div>
            ))}
          </nav>

          {/* --- FULL WIDTH MEGA MENU (single instance, avoids overlap) --- */}
          <AnimatePresence mode="wait">
            {(() => {
              const activeItem = MENU_DATA.find(
                (item) =>
                  item.type === 'megamenu' &&
                  item.labelKey === activeMegaMenu,
              )
              if (!activeItem) return null
              return (
                <motion.div
                  key={activeItem.labelKey}
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{ duration: 0.15, ease: 'easeOut' }}
                  className="fixed left-0 right-0 top-20 bg-white border-b border-gray-100 shadow-xl z-40"
                  onMouseEnter={() =>
                    handleMegaMenuOpen(activeItem.labelKey)
                  }
                  onMouseLeave={handleMegaMenuClose}
                >
                  {/* Red Accent Line at top of menu */}
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 via-red-600 to-red-500" />

                  <div className="container mx-auto px-4 py-8">
                    <div className="flex gap-12">
                      {/* Left: Section Info */}
                      <div className="w-1/4 pr-8 border-r border-gray-100">
                        <h2 className="text-2xl font-extrabold text-slate-900 mb-2">
                          {t(activeItem.labelKey)}
                        </h2>
                        {activeItem.descriptionKey && (
                          <p className="text-sm text-slate-500 leading-relaxed">
                            {t(activeItem.descriptionKey)}
                          </p>
                        )}
                        <div className="mt-6">
                          <Link
                            href="/lois"
                            onClick={handleMegaMenuClose}
                            className="inline-flex items-center text-sm font-bold text-red-600 hover:text-red-700 hover:underline"
                          >
                            {t('menu.footer.viewAllTexts')}{' '}
                            <ArrowRight className="ml-1 h-4 w-4" />
                          </Link>
                        </div>
                      </div>

                      {/* Right: Grid Content */}
                      <div className="flex-1 grid grid-cols-3 gap-8">
                        {activeItem.columns?.map((column, colIndex) => (
                          <div key={colIndex} className="space-y-4">
                            <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                              {t(column.titleKey)}
                            </h3>
                            <ul className="space-y-2">
                              {column.items.map((subItem) => (
                                <li key={subItem.labelKey}>
                                  <Link
                                    href={subItem.href}
                                    onClick={handleMegaMenuClose}
                                    className="group block py-1"
                                  >
                                    <span className="text-sm font-semibold text-slate-700 transition-colors group-hover:text-red-600">
                                      {t(subItem.labelKey)}
                                    </span>
                                    {subItem.descriptionKey && (
                                      <p className="text-xs text-slate-400 group-hover:text-slate-500 line-clamp-1">
                                        {t(subItem.descriptionKey)}
                                      </p>
                                    )}
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )
            })()}
          </AnimatePresence>

          {/* 3. RIGHT ACTIONS (Add-text "+" + User menu + Language + Mobile) */}
          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-2">
              {/* "+" — opens a dropdown with the per-type import
                  shortcuts and the Console éditoriale entry at the
                  bottom. Editor-only; single focal point in place of
                  the earlier "Console pill + Plus button" pair. */}
              <AddTextButton />
              <UserMenu />
            </div>

            {/* Language switcher — always visible. Flag only on mobile,
                flag + full name on sm+. */}
            <LanguageSwitcher variant="responsive" />

            {/* Mobile Trigger */}
            <Button
              variant="ghost"
              size="icon"
              aria-label={mobileOpen ? t('nav.menuClose') : t('nav.menuOpen')}
              aria-expanded={mobileOpen}
              aria-controls="mobile-nav"
              className="xl:hidden h-11 w-11 text-slate-900 hover:bg-slate-100 hover:text-red-600"
              onClick={() => setMobileOpen(true)}
            >
              <AnimatedHamburger isOpen={mobileOpen} />
            </Button>
          </div>
        </div>
      </motion.header>

      {/* --- 4. MOBILE DRAWER (Slide-in) --- */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 z-[60] bg-slate-900/40 backdrop-blur-sm xl:hidden"
            />

            <motion.div
              id="mobile-nav"
              role="dialog"
              aria-modal="true"
              aria-label={t('nav.menuOpen')}
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 right-0 z-[61] w-[85%] max-w-sm bg-white shadow-2xl xl:hidden flex flex-col"
            >
              <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-slate-50">
                <BrandLogo
                  titleClassName="text-slate-900 font-bold text-lg"
                  taglineClassName="hidden"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t('nav.menuClose')}
                  onClick={() => setMobileOpen(false)}
                  className="h-11 w-11 rounded-full hover:bg-white hover:text-red-600"
                >
                  <AnimatedHamburger isOpen={true} />
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto py-6 px-4 space-y-2">
                {/* Editor-only quick actions (profile, console,
                    imports, sign-out). Hidden for signed-out
                    visitors — they still get the
                    "Connexion éditoriale" link below. Fixes the gap
                    where mobile users had no way to log out or hit
                    the import shortcuts that the desktop "+" /
                    avatar buttons provide. */}
                <MobileUserSection
                  onItemClick={() => setMobileOpen(false)}
                />
                {MENU_DATA.map((item, index) => (
                  <MobileMenuItem
                    key={index}
                    item={item}
                    closeMenu={() => setMobileOpen(false)}
                  />
                ))}

                {/* Items missing from MENU_DATA but expected by mobile users
                    (subagent audit found these gaps): advanced search +
                    editor sign-in. Both live in the footer/header on
                    desktop only. */}
                <div className="mt-6 pt-6 border-t border-gray-100 space-y-2">
                  <Link
                    href="/recherche/avancee"
                    onClick={() => setMobileOpen(false)}
                    className="block rounded-lg px-4 py-3 text-base font-bold text-slate-700 hover:bg-red-50 hover:text-red-600 transition-colors"
                  >
                    {t('nav.advancedSearch')}
                  </Link>
                  {authStatus !== 'authenticated' && (
                    <Link
                      href="/sign-in"
                      onClick={() => setMobileOpen(false)}
                      className="block rounded-lg px-4 py-3 text-base font-bold text-slate-700 hover:bg-red-50 hover:text-red-600 transition-colors"
                    >
                      {t('nav.editorSignIn')}
                    </Link>
                  )}
                </div>
              </div>

            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}

// --- MOBILE SUB-COMPONENT ---
function MobileMenuItem({
  item,
  closeMenu,
}: {
  item: any
  closeMenu: () => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const { t } = useT()

  if (item.type === 'link') {
    return (
      <Link
        href={item.href}
        onClick={closeMenu}
        className={cn(
          'group relative block rounded-xl px-4 py-3.5',
          'text-base font-semibold text-slate-800',
          'border border-slate-200/70 bg-white',
          'shadow-[0_1px_2px_-1px_rgba(15,23,42,0.04)]',
          'hover:border-red-200 hover:bg-red-50/50 hover:text-red-700',
          'transition-all duration-200',
          'active:scale-[0.99]',
        )}
      >
        <span className="relative z-10">{t(item.labelKey)}</span>
        {/* Subtle red accent bar on hover — slides in from the left. */}
        <span
          className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-0.5 rounded-r-full bg-red-500 opacity-0 transition-opacity group-hover:opacity-100"
          aria-hidden
        />
      </Link>
    )
  }

  return (
    <div
      className={cn(
        'rounded-xl border bg-white overflow-hidden',
        'transition-all duration-200',
        isOpen
          ? 'border-red-200 shadow-[0_6px_16px_-8px_rgba(220,38,38,0.18)]'
          : 'border-slate-200/70 shadow-[0_1px_2px_-1px_rgba(15,23,42,0.04)]',
      )}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        className={cn(
          'flex w-full items-center justify-between px-4 py-3.5',
          'text-left transition-colors',
          isOpen ? 'bg-red-50/40' : 'bg-white hover:bg-slate-50',
        )}
      >
        <span
          className={cn(
            'text-base font-semibold transition-colors',
            isOpen ? 'text-red-700' : 'text-slate-800',
          )}
        >
          {t(item.labelKey)}
        </span>
        <span
          className={cn(
            'inline-flex items-center justify-center w-7 h-7 rounded-full',
            'transition-all duration-300',
            isOpen
              ? 'bg-red-100 text-red-600'
              : 'bg-slate-100 text-slate-500',
          )}
        >
          <ChevronDown
            className={cn(
              'h-4 w-4 transition-transform duration-300',
              isOpen && 'rotate-180',
            )}
          />
        </span>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{
              height: { duration: 0.25, ease: [0.22, 1, 0.36, 1] },
              opacity: { duration: 0.18, ease: 'easeOut' },
            }}
            style={{ overflow: 'hidden' }}
          >
            <div className="px-4 pb-4 pt-3 space-y-5 border-t border-red-100/60 bg-gradient-to-b from-red-50/30 to-transparent">
              {item.columns?.map((column: any, colIndex: number) => (
                <div key={colIndex}>
                  <h4 className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-red-600/80">
                    {t(column.titleKey)}
                  </h4>
                  <div className="space-y-0.5">
                    {column.items.map((subItem: any) => (
                      <Link
                        key={subItem.href}
                        href={subItem.href}
                        onClick={closeMenu}
                        className={cn(
                          'flex items-center justify-between gap-2',
                          'py-2 px-2 rounded-md',
                          'text-sm font-medium text-slate-700',
                          'hover:bg-white hover:text-red-700',
                          'transition-colors duration-150',
                          'active:bg-red-50',
                        )}
                      >
                        <span>{t(subItem.labelKey)}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
