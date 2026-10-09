'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ExternalLink, Play } from 'lucide-react'

const experienceImages = [
  { src: '/masterclass/mc-gilles.jpg', alt: 'Deelnemers tijdens een interactieve masterclass' },
  { src: '/masterclass/mc-podium.jpg', alt: 'Presentatie tijdens de Archer Masterclass' },
  { src: '/masterclass/mc-coaching.jpg', alt: 'Persoonlijke begeleiding tijdens de masterclass' },
  { src: '/masterclass/mc-diner.jpg', alt: 'Deelnemers tijdens het gezamenlijke diner' },
  { src: '/masterclass/mc-hall.jpg', alt: 'De masterclass in de historische zaal' },
  { src: '/masterclass/mc-venue.png', alt: 'De locatie van de Archer Masterclass' },
  { src: '/masterclass/mc-publiek.jpg', alt: 'Deelnemers volgen de presentatie' },
]

const testimonials = [
  { src: '/testimonials/delphine-van-loocke.png', alt: 'Ervaring van Delphine Van Loocke' },
  { src: '/testimonials/sigurd-staelens.png', alt: 'Ervaring van Sigurd Staelens' },
  { src: '/testimonials/t-k.png', alt: 'Ervaring van een deelnemer' },
  { src: '/testimonials/thomas-driessen.png', alt: 'Ervaring van Thomas Driessen' },
  { src: '/testimonials/wilmer-v.png', alt: 'Ervaring van Wilmer' },
  { src: '/testimonials/yasmine-kustermans.png', alt: 'Ervaring van Yasmine Kustermans' },
]

export function HomeParticipantExperiences() {
  return (
    <section
      aria-labelledby="participant-experiences-title"
      className="overflow-hidden rounded-3xl border border-border/60 bg-card px-5 py-12 text-card-foreground shadow-sm sm:px-8 sm:py-16 lg:px-12"
    >
      <header className="mx-auto max-w-4xl text-center">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">
          Ervaringen van deelnemers
        </p>
        <h2
          id="participant-experiences-title"
          className="mt-3 text-balance text-3xl font-bold leading-[1.05] tracking-[-0.04em] sm:text-4xl lg:text-5xl"
        >
          Dit is wat deelnemers na vier dagen{' '}
          <span className="text-primary">anders zien, beslissen en doen.</span>
        </h2>
      </header>

      <div className="mx-auto mt-10 flex max-w-4xl flex-col items-center gap-4">
        <Link
          href="/masterclass"
          aria-label="Bekijk de ervaringen van deelnemers"
          className="group relative aspect-[9/14] w-full max-w-72 overflow-hidden rounded-2xl bg-muted shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          <Image
            src={experienceImages[0].src}
            alt={experienceImages[0].alt}
            fill
            sizes="288px"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
          <span className="absolute inset-0 bg-foreground/10 transition-colors group-hover:bg-foreground/20" />
          <span className="absolute left-1/2 top-1/2 flex size-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-background text-primary shadow-xl transition-transform group-hover:scale-105">
            <Play className="ml-0.5 size-5" fill="currentColor" />
          </span>
        </Link>

        <div className="flex max-w-full gap-2 overflow-hidden py-1" aria-label="Sfeerbeelden van de masterclass">
          {experienceImages.map((image, index) => (
            <div
              key={image.src}
              className={`relative h-12 w-9 shrink-0 overflow-hidden rounded-lg bg-muted ring-1 ${index === 0 ? 'ring-2 ring-primary ring-offset-2' : 'ring-border'}`}
            >
              <Image src={image.src} alt="" fill sizes="36px" className="object-cover" />
            </div>
          ))}
        </div>
      </div>

      <div className="mx-auto mt-10 grid max-w-5xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {testimonials.map((testimonial, index) => (
          <article
            key={testimonial.src}
            className={`overflow-hidden rounded-2xl border border-border/70 bg-background shadow-lg ${index % 3 === 0 ? 'lg:-rotate-1' : index % 3 === 2 ? 'lg:rotate-1' : ''}`}
          >
            <Image
              src={testimonial.src}
              alt={testimonial.alt}
              width={1542}
              height={1028}
              sizes="(min-width: 1024px) 300px, (min-width: 640px) 45vw, 90vw"
              className="h-auto w-full"
            />
          </article>
        ))}
      </div>

      <footer className="mt-10 flex flex-col items-center gap-3 text-center">
        <a
          href="https://www.trustpilot.com/review/archer.academy"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 text-sm font-bold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          Lees alle ervaringen op Trustpilot
          <ExternalLink className="size-4" aria-hidden="true" />
        </a>
        <p className="text-xs text-muted-foreground">
          Persoonlijke ervaringen. Resultaten verschillen per deelnemer.
        </p>
      </footer>
    </section>
  )
}
