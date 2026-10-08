'use client'

import Player from '@vimeo/player'
import { track } from '@vercel/analytics'
import { ArrowRight, ChartNoAxesCombined, GitBranch, Landmark, ListChecks } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'

const outcomes = [
  { number: '01', title: 'Financiële realiteit', text: 'Privé, vennootschap, vastgoed, kredieten, cashflow en beleggingen in één overzicht.', icon: Landmark },
  { number: '02', title: 'Toekomstprojectie', text: 'Je GGR en levensprojectie tot jouw gekozen einddatum.', icon: ChartNoAxesCombined },
  { number: '03', title: 'Scenario’s', text: 'De impact van keuzes rond vastgoed, cash, beleggingen, pensioen en onderneming.', icon: GitBranch },
  { number: '04', title: 'Beslissingsvolgorde', text: 'Wat eerst moet gebeuren, wat kan wachten en wie je daarvoor nodig hebt.', icon: ListChecks },
]

const testimonials = [
  { id: '1234030300', title: 'Ik dacht dat ik een rendementsprobleem had.' },
  { id: '1234030322', title: 'Voor het eerst zag ik privé en vennootschap als één geheel.' },
  { id: '1234030337', title: 'Ik wist eindelijk wat eerst moest gebeuren.' },
]

function TrackedTestimonial({ id, title, index }: (typeof testimonials)[number] & { index: number }) {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    if (!iframeRef.current) return
    const player = new Player(iframeRef.current)
    let tracked = false
    const onPlay = () => {
      if (tracked) return
      tracked = true
      track(`Testimonial ${index + 1} bekeken`, { videoId: id })
    }
    player.on('play', onPlay)
    return () => { player.off('play', onPlay) }
  }, [id, index])

  return (
    <article className="min-w-0">
      <div className="relative aspect-[9/16] overflow-hidden rounded-xl bg-foreground shadow-sm">
        <iframe
          ref={iframeRef}
          src={`https://player.vimeo.com/video/${id}?badge=0&autopause=1&title=0&byline=0&portrait=0&dnt=1`}
          title={title}
          allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          loading="lazy"
          allowFullScreen
          className="absolute inset-0 size-full border-0"
        />
      </div>
      <h3 className="mt-3 text-balance text-sm font-semibold leading-6 text-foreground">“{title}”</h3>
    </article>
  )
}

interface MasterclassDecisionContentProps {
  primarySignup: React.ReactNode
  closingSignup: React.ReactNode
}

export default function MasterclassDecisionContent({ primarySignup, closingSignup }: MasterclassDecisionContentProps) {
  const primarySelectorRef = useRef<HTMLDivElement>(null)
  const closingSelectorRef = useRef<HTMLElement>(null)
  const trackedProgress = useRef(new Set<number>())
  const [showStickyCta, setShowStickyCta] = useState(false)

  useEffect(() => { track('Page viewed', { page: 'masterclass' }) }, [])

  useEffect(() => {
    const selector = primarySelectorRef.current
    if (!selector) return
    const observer = new IntersectionObserver(([entry]) => {
      setShowStickyCta(!entry.isIntersecting && entry.boundingClientRect.top < 0)
    }, { threshold: 0.1 })
    observer.observe(selector)
    return () => observer.disconnect()
  }, [])

  const scrollToDate = () => {
    closingSelectorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    track('Sticky CTA geklikt')
  }

  const trackProofProgress = (event: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = event.currentTarget
    if (!video.duration) return
    const percentage = (video.currentTime / video.duration) * 100
    for (const milestone of [25, 50]) {
      if (percentage >= milestone && !trackedProgress.current.has(milestone)) {
        trackedProgress.current.add(milestone)
        track(`Proof video ${milestone}% bekeken`)
      }
    }
  }

  return (
    <main className="min-h-screen bg-background font-sans text-foreground">
      <header className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Invest Masterclass</p>
      </header>

      <section className="border-y border-border px-4 py-6 sm:px-6 sm:py-8" aria-labelledby="masterclass-title">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)] lg:items-start">
          <div>
            <h1 id="masterclass-title" className="max-w-3xl text-balance text-3xl font-semibold tracking-[-0.04em] sm:text-4xl lg:text-5xl lg:leading-[1.08]">
              Je hebt gezien waarom je een plan nodig hebt. Nu kies je wanneer je het bouwt.
            </h1>
            <p className="mt-4 max-w-3xl text-pretty text-base leading-7 text-muted-foreground sm:text-lg">
              Bekijk hoe we tijdens vier live dagen jouw privévermogen, vennootschap, vastgoed en beleggingen samenbrengen in één beslissingsplan.
            </p>
            <div className="mt-5 overflow-hidden rounded-xl border border-border bg-muted shadow-sm">
              <video
                controls
                playsInline
                preload="metadata"
                poster="/masterclass/mc-hero.png"
                className="aspect-video w-full object-cover"
                onPlay={() => track('Proof video started')}
                onTimeUpdate={trackProofProgress}
                onEnded={() => track('Proof video voltooid')}
              >
                <source src="/hero-intro.mp4" type="video/mp4" />
                Je browser ondersteunt deze video niet.
              </video>
            </div>
          </div>
          <div ref={primarySelectorRef}>{primarySignup}</div>
        </div>
      </section>

      <section className="px-4 py-10 sm:px-6 sm:py-12" aria-labelledby="outcomes-title">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <h2 id="outcomes-title" className="max-w-2xl text-balance text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">
              Vier outputs waarmee je kunt beslissen.
            </h2>
            <p className="max-w-md text-sm leading-6 text-muted-foreground">Geen losse adviezen, maar één financieel beslissingsplan met jouw cijfers.</p>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {outcomes.map(outcome => {
              const Icon = outcome.icon
              return (
                <article key={outcome.number} className="flex min-h-36 gap-4 rounded-xl border border-border bg-card p-5 shadow-sm">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon aria-hidden="true" /></span>
                  <div>
                    <p className="font-mono text-xs font-semibold text-primary">{outcome.number}</p>
                    <h3 className="mt-1 text-lg font-semibold text-foreground">{outcome.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{outcome.text}</p>
                  </div>
                </article>
              )
            })}
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-muted/30 px-4 py-10 sm:px-6 sm:py-12" aria-labelledby="testimonials-title">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Deelnemers aan het woord</p>
            <h2 id="testimonials-title" className="mt-2 text-balance text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">Van losse vragen naar één verdedigbaar plan.</h2>
          </div>
          <div className="mt-6 grid grid-cols-3 gap-3 sm:gap-5">
            {testimonials.map((testimonial, index) => <TrackedTestimonial key={testimonial.id} {...testimonial} index={index} />)}
          </div>
        </div>
      </section>

      <section ref={closingSelectorRef} className="scroll-mt-4 px-4 py-10 sm:px-6 sm:py-12" aria-labelledby="closing-date-title">
        <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Jouw volgende stap</p>
            <h2 id="closing-date-title" className="mt-2 text-balance text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">Kies de editie waarop jij jouw vermogensplan bouwt.</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">Je kiest alleen je voorkeursdatum. Daarna bespreken we persoonlijk of de Masterclass bij je situatie past.</p>
          </div>
          {closingSignup}
        </div>
      </section>

      {showStickyCta ? (
        <div className="fixed inset-x-0 bottom-0 border-t border-border bg-background/95 p-3 shadow-lg backdrop-blur sm:inset-x-auto sm:bottom-auto sm:right-5 sm:top-5 sm:rounded-xl sm:border sm:p-2">
          <Button type="button" onClick={scrollToDate} className="min-h-11 w-full sm:w-auto">
            <span className="sm:hidden">Kies je voorkeursdatum</span>
            <span className="hidden sm:inline">Kies je editie</span>
            <ArrowRight data-icon="inline-end" aria-hidden="true" />
          </Button>
        </div>
      ) : null}
    </main>
  )
}
