'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { Clock, Settings, LogOut, Home, PlaySquare, ListChecks, ShieldCheck, BarChart3 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useApp } from './app-context'
import { SidebarCallStatus } from './SidebarCallStatus'
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

  const navGroups: { label: string; items: NavItem[]; adminOnly?: boolean }[] = [
    {
      label: tr.nav.overview,
      items: [
        { label: tr.nav.home, href: '/home', icon: <Home size={16} /> },
        { label: tr.nav.traject, href: '/traject', icon: <PlaySquare size={16} /> },
        { label: 'Mijn voortgang', href: '/traject#voortgang', icon: <ListChecks size={16} /> },
      ],
    },
    {
      label: tr.nav.admin,
      adminOnly: true,
      items: [
        { label: tr.nav.adminCenter, href: '/admin', icon: <ShieldCheck size={16} />, adminOnly: true },
        { label: 'Analytics', href: '/admin/analytics', icon: <BarChart3 size={16} />, adminOnly: true },
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
                        className={cn(
                          'flex items-center gap-2.5 px-3 py-3 sm:py-2 rounded-full text-sm font-medium transition-all duration-150',
                        )}
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

              </ul>
            </div>
          )
        })}
      </nav>

      {/* Trial countdown + profile */}
      <div className="px-3 pb-4 space-y-3 border-t" style={{ borderColor: '#e8ecf4', paddingTop: '12px' }}>
        {/* Ingepland oriëntatiegesprek — clean calendar-popup */}
        <SidebarCallStatus onNavigate={onNavigate} />

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

function MobileBottomNav() {
  const pathname = usePathname()
  const { user, locale } = useApp()
  const tr = t(locale)
  const isMentorOrAdmin = user?.role === 'admin' || user?.role === 'mentor'

  const items: NavItem[] = [
    { label: tr.nav.home, href: '/home', icon: <Home size={21} /> },
    { label: tr.nav.traject, href: '/traject', icon: <PlaySquare size={21} /> },
    { label: 'Mijn voortgang', href: '/traject#voortgang', icon: <ListChecks size={21} /> },
  ]

  if (isMentorOrAdmin) {
    items.push({ label: tr.nav.adminCenter, href: '/admin', icon: <ShieldCheck size={21} /> })
  }

  return (
    <nav
      aria-label="Hoofdnavigatie"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background pb-[env(safe-area-inset-bottom)] sm:hidden"
    >
      <ul className="flex min-h-20 items-stretch gap-1 px-2 py-2">
        {items.map((item) => {
          const active = !item.external && (pathname === item.href || pathname.startsWith(`${item.href}/`))

          return (
            <li key={item.href} className="flex min-w-0 flex-1">
              <Link
                href={item.href}
                target={item.external ? '_blank' : undefined}
                rel={item.external ? 'noopener noreferrer' : undefined}
                aria-current={active ? 'page' : undefined}
                aria-label={item.external ? `${item.label} openen in een nieuw tabblad` : item.label}
                className={cn(
                  'flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 text-center transition-colors',
                  active ? 'bg-primary/10 text-primary' : 'text-muted-foreground',
                )}
              >
                <span aria-hidden="true">{item.icon}</span>
                <span
                  className={cn(
                    'whitespace-nowrap font-medium leading-tight',
                    isMentorOrAdmin ? 'text-[8px] min-[375px]:text-[9px]' : 'text-[9px] min-[375px]:text-[10px]',
                  )}
                >
                  {item.label}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

export function Sidebar() {
  return (
    <>
      <MobileBottomNav />

      <aside
        className="hidden h-full w-[220px] shrink-0 flex-col sm:flex"
        style={{ background: '#ffffff', borderRight: '1px solid #e8ecf4' }}
      >
        <SidebarContent />
      </aside>
    </>
  )
}
