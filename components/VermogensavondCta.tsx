import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

const WORKSHOPS_URL = 'https://workshops.archerinvest.be'

export function VermogensavondCta() {
  return (
    <section
      aria-labelledby="vermogensavond-title"
      className="flex flex-col gap-6 rounded-2xl bg-primary px-5 py-6 text-primary-foreground shadow-sm sm:px-8 sm:py-7 lg:flex-row lg:items-center lg:justify-between"
    >
      <div className="flex max-w-3xl flex-col gap-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary-foreground/70">
          Het kennismaking event
        </p>
        <div className="flex flex-col gap-2">
          <h2 id="vermogensavond-title" className="text-balance text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
            Neem je vermogensopbouw serieus.
          </h2>
          <p className="max-w-2xl text-pretty text-sm leading-6 text-primary-foreground/80 sm:text-base">
            Live financiële educatie en Q&amp;A met Anthony Swolfs en het Archer-team, walking dinner en ontmoeting met netwerkmoment inbegrepen.
          </p>
        </div>
        <div className="flex flex-wrap gap-2" aria-label="Wat je mag verwachten">
          {['Je vertrekpunt helder', 'Inzicht in je blinde vlekken', 'Concrete volgende stappen'].map((item) => (
            <span key={item} className="rounded-full bg-primary-foreground/15 px-3 py-1 text-xs font-medium text-primary-foreground/90">
              {item}
            </span>
          ))}
        </div>
      </div>

      <Link
        href={WORKSHOPS_URL}
        className="group inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-primary-foreground px-5 py-3 text-sm font-bold text-primary transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
      >
        Reserveer mijn plaats
        <ArrowRight size={17} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5" />
      </Link>
    </section>
  )
}
