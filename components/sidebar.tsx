'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Clock, Settings, LogOut, Home, PlaySquare, CalendarDays, GraduationCap, ShieldCheck, ClipboardList, Lock, Menu, X } from 'lucide-react'
import { useApp } from './app-context'
import { t } from '@/lib/i18n'

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
  adminOnly?: boolean
  external?: boolean
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, trialDaysLeft, isExpired, isAdminOrMentor, locale } = useApp()
  const tr = t(locale)

  const isMentorOrAdmin = user?.role === 'admin' || user?.role === 'mentor'
  const { allCoreCompleted } = useApp()

  const navGroups: { label: string; items: NavItem[]; adminOnly?: boolean }[] = [
    {
      label: tr.nav.overview,
      items: [
        { label: tr.nav.home, href: '/home', icon: <Home size={16} /> },
        { label: tr.nav.traject, href: '/traject', icon: <PlaySquare size={16} /> },
        {
          label: tr.nav.events,
          href: 'https://workshops.archerinvest.be',
          icon: <CalendarDays size={16} />,
          external: true,
        },
        { label: tr.nav.masterclass, href: '/masterclass', icon: <GraduationCap size={16} /> },
      ],
    },
    {
      label: tr.nav.admin,
      adminOnly: true,
      items: [
        { label: tr.nav.adminCenter, href: '/admin', icon: <ShieldCheck size={16} />, adminOnly: true },
      ],
    },
  ]

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  return (
    <>
      {/* Logo */}
      <div className="px-5 flex flex-col justify-center shrink-0" style={{ height: '73px' }}>
        <Image
          src="/archer-logo.png"
          alt="Archer"
          width={80}
          height={20}
          className="w-20 h-auto"
          priority
        />
        <p className="text-[11px] mt-0.5" style={{ color: 'rgba(13,15,20,0.45)' }}>
          We all have a mind to invest.
        </p>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {navGroups.map((group) => {
          if (group.adminOnly && !isMentorOrAdmin) return null
          return (
            <div key={group.label}>
              <p
                className="px-2 mb-1.5 text-[10px] font-semibold tracking-widest uppercase"
                style={{ color: 'rgba(13,15,20,0.38)' }}
              >
                {group.label}
              </p>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  if (item.adminOnly && !isMentorOrAdmin) return null
                  const active = !item.external && (pathname === item.href || pathname.startsWith(item.href + '/'))
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        target={item.external ? '_blank' : undefined}
                        rel={item.external ? 'noopener noreferrer' : undefined}
                        aria-label={item.external ? `${item.label} openen in een nieuw tabblad` : undefined}
                        onClick={onNavigate}
                        className="flex items-center gap-2.5 px-3 py-3 sm:py-2 rounded-full text-sm font-medium transition-all duration-150"
                        style={
                          active
                            ? { background: '#2500F5', color: '#ffffff' }
                            : { color: 'rgba(13,15,20,0.65)' }
                        }
                      >
                        <span style={{ opacity: active ? 1 : 0.6 }}>{item.icon}</span>
                        {item.label}
                      </Link>
                    </li>
                  )
                })}

                {/* Quiz item — only shown in overview group */}
                {group.label === tr.nav.overview && (
                  <li key="quiz">
                    {allCoreCompleted ? (
                      <Link
                        href="/quiz"
                        onClick={onNavigate}
                        className="flex items-center gap-2.5 px-3 py-3 sm:py-2 rounded-full text-sm font-medium transition-all duration-150"
                        style={
                          pathname === '/quiz'
                            ? { background: '#2500F5', color: '#ffffff' }
                            : { color: 'rgba(13,15,20,0.65)' }
                        }
                      >
                        <span style={{ opacity: pathname === '/quiz' ? 1 : 0.6 }}>
                          <ClipboardList size={16} />
                        </span>
                        Quiz
                      </Link>
                    ) : (
                      <div
                        className="group relative flex items-center gap-2.5 px-3 py-3 sm:py-2 rounded-full text-sm font-medium cursor-default select-none"
                        style={{ color: 'rgba(13,15,20,0.3)' }}
                      >
                        <span style={{ opacity: 0.4 }}><ClipboardList size={16} /></span>
                        Quiz
                        <Lock size={11} className="ml-auto" style={{ opacity: 0.4 }} />
                        {/* Tooltip */}
                        <div
                          className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 z-50 hidden group-hover:block"
                        >
                          <div
                            className="rounded-lg px-3 py-2 text-xs font-medium whitespace-nowrap shadow-lg"
                            style={{ background: '#0d0f14', color: '#fff', maxWidth: '220px', whiteSpace: 'normal' }}
                          >
                            Bekijk eerst alle 6 video&apos;s om de quiz vrij te spelen.
                          </div>
                        </div>
                      </div>
                    )}
                  </li>
                )}
              </ul>
            </div>
          )
        })}
      </nav>

      {/* Trial countdown + profile */}
      <div className="px-3 pb-4 space-y-3 border-t" style={{ borderColor: '#e8ecf4', paddingTop: '12px' }}>
        {/* Trial pill */}
        {isAdminOrMentor ? (
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-full text-xs font-medium"
            style={{ background: 'rgba(37,0,245,0.08)', color: '#2500F5' }}
          >
            <ShieldCheck size={12} />
            Onbeperkte toegang
          </div>
        ) : user?.activated_at && (
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-full text-xs font-medium"
            style={
              isExpired
                ? { background: 'rgba(239,68,68,0.1)', color: '#ef4444' }
                : { background: 'rgba(37,0,245,0.08)', color: '#2500F5' }
            }
          >
            <Clock size={12} />
            {isExpired
              ? tr.nav.trialExpired
              : `${trialDaysLeft} ${tr.nav.daysLeft}`}
          </div>
        )}

        {/* Profile */}
        <div className="flex items-center gap-2.5 px-2">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
            style={{ background: '#2500F5' }}
          >
            {user?.name?.charAt(0)?.toUpperCase() ?? user?.email?.charAt(0)?.toUpperCase() ?? '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate" style={{ color: '#0d0f14' }}>{user?.email}</p>
            <p className="text-[10px]" style={{ color: 'rgba(13,15,20,0.4)' }}>Invest trial</p>
          </div>
          <div className="flex items-center gap-1">
            <Link
              href="/settings"
              onClick={onNavigate}
              className="p-2 -m-1 rounded-md transition-colors"
              style={{ color: 'rgba(13,15,20,0.35)' }}
            >
              <Settings size={13} />
            </Link>
            <button
              onClick={handleLogout}
              className="p-2 -m-1 rounded-md transition-colors"
              style={{ color: 'rgba(13,15,20,0.35)' }}
            >
              <LogOut size={13} />
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

/**
 * Mobile topbar: fixed header with logo + hamburger. Renders only < sm.
 * Tapping the hamburger opens a full-height slide-in drawer with the same
 * nav content as the desktop sidebar.
 */
function MobileTopbar() {
  const [open, setOpen] = useState(false)

  // Lock body scroll while the drawer is open, and close on route change.
  const pathname = usePathname()
  useEffect(() => { setOpen(false) }, [pathname])
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = prev }
    }
  }, [open])

  return (
    <div className="sm:hidden">
      {/* Fixed top bar */}
      <div
        className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4"
        style={{ height: '56px', background: '#ffffff', borderBottom: '1px solid #e8ecf4' }}
      >
        <Image src="/archer-logo.png" alt="Archer" width={72} height={18} className="w-[72px] h-auto" priority />
        <button
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="flex items-center justify-center rounded-full"
          style={{ width: 44, height: 44, color: '#0d0f14' }}
        >
          <Menu size={22} />
        </button>
      </div>

      {/* Drawer overlay */}
      {open && (
        <div
          className="fixed inset-0 z-50"
          style={{ background: 'rgba(8,10,20,0.45)' }}
          onClick={() => setOpen(false)}
        >
          <aside
            className="absolute top-0 left-0 h-full w-[85%] max-w-[320px] flex flex-col"
            style={{ background: '#ffffff' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-end px-3 pt-2 shrink-0">
              <button
                onClick={() => setOpen(false)}
                aria-label="Sluit menu"
                className="flex items-center justify-center rounded-full"
                style={{ width: 44, height: 44, color: 'rgba(13,15,20,0.5)' }}
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex flex-col flex-1 min-h-0 -mt-2">
              <SidebarContent onNavigate={() => setOpen(false)} />
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}

export function Sidebar() {
  return (
    <>
      {/* Mobile: fixed topbar + slide-in drawer, no static layout space reserved */}
      <MobileTopbar />

      {/* Desktop / tablet: static sidebar */}
      <aside
        className="hidden sm:flex flex-col h-full w-[220px] shrink-0"
        style={{ background: '#ffffff', borderRight: '1px solid #e8ecf4' }}
      >
        <SidebarContent />
      </aside>
    </>
  )
}
