'use client'

import Image from 'next/image'
import Link from 'next/link'
import Player from '@vimeo/player'
import { track } from '@vercel/analytics'
import { ArrowLeft, ArrowRight, Check, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'

const outcomes = [
  {
    number: '01',
    title: 'Je financiële realiteit',
    text: 'Privé, vennootschap, vastgoed, kredieten, cashflow en beleggingen in één overzicht.',
  },
  {
    number: '02',
    title: 'Je toekomst',
    text: 'Je GGR en levensprojectie tot jouw gekozen einddatum.',
  },
  {
    number: '03',
    title: 'Je mogelijkheden',
    text: 'Scenario’s voor vastgoed, cash, beleggingen, pensioen en onderneming.',
  },
  {
    number: '04',
    title: 'Je volgorde',
    text: 'Wat eerst moet gebeuren, wat kan wachten en wie je daarvoor nodig hebt.',
  },
]

const testimonials = [
  {
    id: '1234030300',
    title: 'Ik dacht dat ik een rendementsprobleem had.',
    context: 'Van losse producten naar zicht op de echte financiële vraag.',
  },
  {
    id: '1234030322',
    title: 'Voor het eerst zag ik privé en vennootschap als één geheel.',
    context: 'Eén overzicht maakte duidelijk welke beslissing ontbrak.',
  },
  {
    id: '1234030337',
    title: 'Ik wist eindelijk wat eerst moest gebeuren.',
    context: 'Niet meer tegelijk optimaliseren, maar uitvoeren in de juiste volgorde.',
  },
]

const reviews = [
  ['/testimonials/delphine-van-loocke.png', 'Trustpilot-review van Delphine Van Loocke'],
  ['/testimonials/thomas-driessen.png', 'Trustpilot-review van Thomas Driessen'],
  ['/testimonials/yasmine-kustermans.png', 'Trustpilot-review van Yasmine Kustermans'],
  ['/testimonials/sigurd-staelens.png', 'Trustpilot-review van Sigurd Staelens'],
  ['/testimonials/wilmer-v.png', 'Trustpilot-review van Wilmer V'],
  ['/testimonials/t-k.png', 'Trustpilot-review van T K'],
]

const fitItems = [
  'Je vermogen verspreid zit over meerdere potjes',
  'Je privévermogen en vennootschap niet als één totaalplan bekijkt',
  'Je cash hebt maar niet weet wat er eerst mee moet gebeuren',
  'Je niet afhankelijk wilt blijven van losse adviezen',
  'Je met je eigen cijfers wilt werken',
  'Je naar huis wilt gaan met een beslissingsvolgorde',
]

const noFitItems = [
  'Snel rendement of een tradingtip zoekt',
  'Een gegarandeerd rendement verwacht',
  'Geen eigen cijfers wilt meebrengen',
  'Alleen vrijblijvende informatie wilt',
  'Niet bereid bent om beslissingen te nemen',
]

function TrackedTestimonial({ id, title, context, index }: (typeof testimonials)[number] & { index: number }) {
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
    return () => {
      player.off('play', onPlay)
    }
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
      <h3 className="mt-5 text-balance text-lg font-semibold leading-snug text-foreground sm:text-xl">“{title}”</h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{context}</p>
    </article>
  )
}

export default function MasterclassDecisionContent({ signup }: { signup: React.ReactNode }) {
  const dateSectionRef = useRef<HTMLElement>(null)
  const trustpilotRef = useRef<HTMLElement>(null)
  const trackedProgress = useRef(new Set<number>())
  const [dateSectionVisible, setDateSectionVisible] = useState(false)

  useEffect(() => {
    track('Page viewed', { page: 'masterclass' })
  }, [])

  useEffect(() => {
    const dateSection = dateSectionRef.current
    const trustpilotSection = trustpilotRef.current
    if (!dateSection || !trustpilotSection) return

    const dateObserver = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      setDateSectionVisible(true)
      track('Datumsectie bekeken')
      dateObserver.disconnect()
    }, { threshold: 0.2 })

    const trustpilotObserver = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      track('Trustpilot bekeken')
      trustpilotObserver.disconnect()
    }, { threshold: 0.25 })

    dateObserver.observe(dateSection)
    trustpilotObserver.observe(trustpilotSection)
    return () => {
      dateObserver.disconnect()
      trustpilotObserver.disconnect()
    }
  }, [])

  const scrollToDate = () => dateSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })

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
      <header className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Invest Masterclass</p>
        <Link href="/traject" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft aria-hidden="true" />
          Terug naar Discovery
        </Link>
      </header>

      <section className="px-4 pb-20 pt-12 sm:px-8 sm:pb-28 sm:pt-20" aria-labelledby="masterclass-title">
        <div className="mx-auto flex max-w-5xl flex-col items-center text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Invest Masterclass</p>
          <h1 id="masterclass-title" className="mt-5 max-w-4xl text-balance text-4xl font-semibold tracking-[-0.05em] sm:text-6xl sm:leading-[1.05]">
            Je hebt gezien waarom je een plan nodig hebt. Nu zie je hoe we dat plan met jouw cijfers bouwen.
          </h1>
          <p className="mt-6 max-w-3xl text-pretty text-lg leading-8 text-muted-foreground">
            Bekijk eerst deze korte video. Daarna kun je hieronder de editie kiezen waarop je jouw financiële realiteit omzet in concrete beslissingen.
          </p>

          <div className="mt-12 w-full overflow-hidden rounded-2xl border border-border bg-foreground shadow-lg">
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
          <p className="mt-5 text-sm font-medium text-muted-foreground">Bekijk de video en kies daarna hieronder jouw editie.</p>
        </div>
      </section>

      <section className="border-y border-border px-4 py-20 sm:px-8 sm:py-28" aria-labelledby="outcomes-title">
        <div className="mx-auto max-w-6xl">
          <h2 id="outcomes-title" className="max-w-4xl text-balance text-3xl font-semibold tracking-[-0.04em] sm:text-5xl">
            Wat je na vier dagen niet alleen weet, maar kunt beslissen.
          </h2>
          <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-2">
            {outcomes.map(outcome => (
              <article key={outcome.number} className="bg-card p-7 sm:p-10">
                <p className="font-mono text-sm font-semibold text-primary">{outcome.number}</p>
                <h3 className="mt-5 text-2xl font-semibold tracking-tight text-foreground">{outcome.title}</h3>
                <p className="mt-3 max-w-md text-base leading-7 text-muted-foreground">{outcome.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-20 sm:px-8 sm:py-28" aria-labelledby="testimonials-title">
        <div className="mx-auto max-w-6xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Deelnemers aan het woord</p>
          <h2 id="testimonials-title" className="mt-4 max-w-4xl text-balance text-3xl font-semibold tracking-[-0.04em] sm:text-5xl">
            Niet meer informatie. Een plan dat je kunt verdedigen.
          </h2>
          <div className="mt-12 grid grid-cols-1 gap-10 sm:grid-cols-3 sm:gap-6">
            {testimonials.map((testimonial, index) => (
              <TrackedTestimonial key={testimonial.id} {...testimonial} index={index} />
            ))}
          </div>
        </div>
      </section>

      <section ref={trustpilotRef} className="border-y border-border px-4 py-16 sm:px-8 sm:py-20" aria-labelledby="trustpilot-title">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Trustpilot</p>
              <h2 id="trustpilot-title" className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">Ook achteraf blijft het verschil voelbaar.</h2>
            </div>
            <p className="max-w-md text-sm leading-6 text-muted-foreground">Aanvullend bewijs van deelnemers die het volledige traject doorliepen.</p>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {reviews.map(([src, alt], index) => (
              <figure key={src} className={index > 2 ? 'hidden sm:block' : undefined}>
                <Image src={src} alt={alt} width={1920} height={1278} className="h-auto w-full rounded-xl border border-border" sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" />
              </figure>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-20 sm:px-8 sm:py-28" aria-labelledby="fit-title">
        <div className="mx-auto max-w-6xl">
          <h2 id="fit-title" className="text-balance text-3xl font-semibold tracking-[-0.04em] sm:text-5xl">Deze vier dagen zijn voor jou als je…</h2>
          <div className="mt-10 grid gap-12 lg:grid-cols-[1.2fr_0.8fr] lg:gap-20">
            <ul className="grid gap-5 sm:grid-cols-2">
              {fitItems.map(item => (
                <li key={item} className="flex items-start gap-3 text-base leading-7">
                  <span className="mt-1 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"><Check aria-hidden="true" /></span>
                  {item}
                </li>
              ))}
            </ul>
            <div className="border-l-2 border-border pl-6 sm:pl-8">
              <h3 className="text-lg font-semibold">Niet voor jou als je:</h3>
              <ul className="mt-5 flex flex-col gap-4">
                {noFitItems.map(item => (
                  <li key={item} className="flex items-start gap-3 text-sm leading-6 text-muted-foreground">
                    <X aria-hidden="true" className="mt-1 shrink-0 text-muted-foreground" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section ref={dateSectionRef} className="scroll-mt-4 border-t border-border px-4 py-20 sm:px-8 sm:py-28" aria-labelledby="date-title">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Jouw volgende stap</p>
            <h2 id="date-title" className="mt-4 text-balance text-3xl font-semibold tracking-[-0.04em] sm:text-5xl">Kies de editie waarop jij jouw vermogensplan bouwt.</h2>
            <p className="mt-6 text-base leading-7 text-muted-foreground">Kies vrijblijvend een voorkeursdatum. Daarna bespreekt iemand van ons team persoonlijk of de Masterclass bij jouw situatie past.</p>
          </div>
          <div>{signup}</div>
        </div>
      </section>

      {dateSectionVisible ? (
        <div className="fixed inset-x-0 bottom-0 border-t border-border bg-background/95 p-3 backdrop-blur sm:hidden">
          <Button type="button" onClick={scrollToDate} className="min-h-12 w-full">
            Kies jouw editie
            <ArrowRight data-icon="inline-end" aria-hidden="true" />
          </Button>
        </div>
      ) : null}
    </main>
  )
}
