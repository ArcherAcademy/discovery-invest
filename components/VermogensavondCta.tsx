import Image from 'next/image'
import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'

const KENNISMAKINGSEVENT_URL = '/kennismakingsevent'

export function VermogensavondCta() {
  return (
    <section
      aria-labelledby="vermogensavond-title"
      className="grid overflow-hidden rounded-2xl bg-primary text-primary-foreground shadow-sm md:grid-cols-[1fr_17rem] md:items-stretch"
    >
      <div className="flex flex-col items-start justify-center gap-4 p-6 sm:p-8">
        <div className="flex flex-col gap-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary-foreground/80">
            Nog niet klaar voor vier dagen?
          </p>
          <h2 id="vermogensavond-title" className="max-w-md text-balance text-2xl font-bold leading-tight tracking-tight">
            Kom eerst een avond kennismaken.
          </h2>
          <p className="max-w-xl text-pretty text-sm leading-6 text-primary-foreground/80 sm:text-base">
            Vijf uur met Anthony en het team, walking dinner inbegrepen.
          </p>
        </div>

        <Link
          href={KENNISMAKINGSEVENT_URL}
          className="group inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary-foreground px-5 py-3 text-sm font-bold text-primary transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
        >
          Reserveer mijn plaats
          <ArrowUpRight size={18} aria-hidden="true" className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </Link>
      </div>

      <div className="relative min-h-52 md:m-5 md:ml-0 md:min-h-0 md:overflow-hidden md:rounded-xl">
        <Image
          src="/images/kennismaking-diner.jpeg"
          alt="Deelnemers aan het walking dinner tijdens een Archer-kennismakingsavond"
          fill
          sizes="(min-width: 768px) 272px, 100vw"
          className="object-cover"
        />
      </div>
    </section>
  )
}
