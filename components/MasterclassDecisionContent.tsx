'use client'

import Image from 'next/image'
import { useRef } from 'react'
import { ArrowRight, Check } from 'lucide-react'

const testimonials = [
  { id: '1234030300', name: 'Deelnemer 1' },
  { id: '1234030322', name: 'Deelnemer 2' },
  { id: '1234030337', name: 'Deelnemer 3' },
]

const reviews = [
  ['/testimonials/delphine-van-loocke.png', 'Review van Delphine Van Loocke'],
  ['/testimonials/thomas-driessen.png', 'Review van Thomas Driessen'],
  ['/testimonials/yasmine-kustermans.png', 'Review van Yasmine Kustermans'],
  ['/testimonials/sigurd-staelens.png', 'Review van Sigurd Staelens'],
  ['/testimonials/wilmer-v.png', 'Review van Wilmer V'],
  ['/testimonials/t-k.png', 'Review van T K'],
]

const outcomes = [
  'Je volledige financiële realiteit in één overzicht',
  'Je persoonlijke GGR en levensprojectie',
  'Scenario’s voor vastgoed, cash, beleggingen en pensioen',
  'Een concrete volgorde voor je volgende beslissingen',
]

const days = [
  ['01', 'Je realiteit', 'Privé, vennootschap, vastgoed, kredieten en cash worden één begrijpelijk geheel.'],
  ['02', 'Je toekomst', 'Je ziet wat je huidige keuzes betekenen tegen het moment waarop je anders wilt gaan leven.'],
  ['03', 'Je mogelijkheden', 'Je vergelijkt activaklassen en scenario’s op rendement, risico, tijd en fiscaliteit.'],
  ['04', 'Je plan', 'Je legt vast wat eerst moet gebeuren, wat kan wachten en wie je daarbij nodig hebt.'],
]

function PortraitVideo({ id, name }: { id: string; name: string }) {
  return (
    <figure className="min-w-0">
      <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-muted shadow-sm">
        <iframe
          src={`https://player.vimeo.com/video/${id}?badge=0&autopause=1&title=0&byline=0&portrait=0&dnt=1`}
          title={`Ervaring van ${name}`}
          allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          loading="lazy"
          allowFullScreen
          className="absolute inset-0 size-full border-0"
        />
      </div>
    </figure>
  )
}

interface MasterclassDecisionContentProps {
  primarySignup: React.ReactNode
  closingSignup: React.ReactNode
}

export default function MasterclassDecisionContent({ primarySignup, closingSignup }: MasterclassDecisionContentProps) {
  const signupRef = useRef<HTMLElement>(null)
  const scrollToSignup = () => signupRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })

  return (
    <main className="font-sans pb-20 lg:pb-0">
      <section className="border-b border-border bg-background px-4 py-12 sm:px-6 sm:py-20">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
          <div className="lg:pt-8">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">Invest Masterclass</p>
            <h1 className="mt-5 max-w-3xl text-balance text-4xl font-semibold tracking-[-0.05em] text-foreground sm:text-6xl sm:leading-[1.02]">Vier dagen om eindelijk rust te krijgen in je financiële beslissingen.</h1>
            <p className="mt-7 max-w-2xl text-pretty text-lg leading-8 text-muted-foreground">Niet nog meer losse kennis. Je brengt je eigen cijfers mee en bouwt een vermogensplan dat jij begrijpt, kunt verdedigen en werkelijk kunt uitvoeren.</p>
            <div className="mt-8 flex flex-wrap items-center gap-5">
              <button type="button" onClick={scrollToSignup} className="inline-flex min-h-12 items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">Kies je editie <ArrowRight className="size-4" aria-hidden="true" /></button>
              <span className="text-sm text-muted-foreground">Live in Antwerpen · met jouw eigen cijfers</span>
            </div>
            <blockquote className="mt-12 max-w-xl border-l-2 border-primary pl-5 text-lg leading-8 text-foreground">“Je hoeft na deze vier dagen niet meer te hopen dat je goed bezig bent. Je ziet het.”</blockquote>
          </div>
          <aside className="border-t border-border pt-8 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">{primarySignup}</aside>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 sm:py-24" aria-labelledby="voices-title">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">Geen verkooppraat</p>
            <h2 id="voices-title" className="mt-3 text-balance text-3xl font-semibold tracking-[-0.04em] text-foreground sm:text-5xl">Luister naar wie er zelf vier dagen zat.</h2>
          </div>
          <div className="mt-10 grid grid-cols-3 gap-3 sm:gap-6">{testimonials.map(testimonial => <PortraitVideo key={testimonial.id} {...testimonial} />)}</div>
        </div>
      </section>

      <section className="border-y border-border bg-muted/30 px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[0.75fr_1.25fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">Wat verandert er?</p>
            <h2 className="mt-3 text-balance text-3xl font-semibold tracking-[-0.04em] text-foreground sm:text-5xl">Van veel bezit naar één helder plan.</h2>
            <p className="mt-5 text-base leading-7 text-muted-foreground">De waarde zit niet in een nieuwe tip. Ze zit in het verband tussen alles wat je al hebt.</p>
          </div>
          <ul className="border-t border-border">
            {outcomes.map(outcome => <li key={outcome} className="flex items-start gap-4 border-b border-border py-5 text-base font-medium text-foreground"><Check className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />{outcome}</li>)}
          </ul>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 sm:py-24" aria-labelledby="days-title">
        <div className="mx-auto max-w-6xl">
          <h2 id="days-title" className="max-w-3xl text-balance text-3xl font-semibold tracking-[-0.04em] text-foreground sm:text-5xl">Vier dagen. Eén beweging: van overzicht naar beslissing.</h2>
          <div className="mt-12 grid gap-8 border-t border-border pt-8 md:grid-cols-4">
            {days.map(([number, title, text]) => <article key={number}><p className="font-mono text-sm text-primary">{number}</p><h3 className="mt-4 text-xl font-semibold text-foreground">{title}</h3><p className="mt-3 text-sm leading-6 text-muted-foreground">{text}</p></article>)}
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-background px-4 py-16 sm:px-6 sm:py-24" aria-labelledby="reviews-title">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div><p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">Ervaringen</p><h2 id="reviews-title" className="mt-3 text-balance text-3xl font-semibold tracking-[-0.04em] text-foreground sm:text-5xl">Hun woorden, niet de onze.</h2></div>
            <p className="max-w-sm text-sm leading-6 text-muted-foreground">Echte reacties van deelnemers die hun financiële situatie onder ogen namen.</p>
          </div>
          <div className="mt-10 columns-1 gap-5 sm:columns-2 lg:columns-3">
            {reviews.map(([src, alt]) => <figure key={src} className="mb-5 break-inside-avoid overflow-hidden rounded-xl border border-border bg-card"><Image src={src} alt={alt} width={1920} height={1278} className="h-auto w-full" sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" /></figure>)}
          </div>
        </div>
      </section>

      <section ref={signupRef} className="scroll-mt-8 bg-foreground px-4 py-16 text-background sm:px-6 sm:py-24">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[1fr_0.9fr] lg:items-start">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">Jouw volgende stap</p>
            <h2 className="mt-3 max-w-2xl text-balance text-3xl font-semibold tracking-[-0.04em] sm:text-5xl">Je hoeft vandaag niet alles te beslissen. Alleen of je het gesprek wilt voeren.</h2>
            <p className="mt-6 max-w-xl text-base leading-7 text-background/70">De investering bedraagt €6.200 exclusief btw. Je kiest nu enkel een voorkeursdatum. Daarna bekijken we persoonlijk of de vierdaagse past bij jouw situatie.</p>
          </div>
          <div className="rounded-xl bg-background p-6 text-foreground sm:p-8">{closingSignup}</div>
        </div>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 p-3 backdrop-blur lg:hidden">
        <button type="button" onClick={scrollToSignup} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground">Kies je editie <ArrowRight className="size-4" aria-hidden="true" /></button>
      </div>
    </main>
  )
}
