'use client'

import Image from 'next/image'
import { useRef } from 'react'
import { Check, CircleX, ShieldCheck } from 'lucide-react'

const outcomes = [
  ['Jouw financiële realiteit', 'Privé, vennootschap, vastgoed, kredieten, beleggingen, cashflow en pensioen in één overzicht.'],
  ['Jouw GGR', 'Je ziet wat je volledige vermogen vandaag netto doet, na kosten en inflatie.'],
  ['Jouw levensprojectie', 'Je ziet wat je huidige beleid betekent tegen jouw gekozen einddatum.'],
  ['Jouw scenario’s', 'Je vergelijkt wat er gebeurt wanneer je verkoopt, bijkoopt, uitkeert, langer werkt of anders alloceert.'],
  ['Jouw actievolgorde', 'Een concrete volgorde: wat eerst moet gebeuren, tegen wanneer en met wie.'],
]

const days = [
  ['Dag 1', 'Financiële realiteit', 'Je brengt je volledige financiële situatie in kaart. Privé en vennootschap worden afzonderlijk bekeken en als één totaalbeeld begrepen.'],
  ['Dag 2', 'Levensloop en projectie', 'Je ziet wat je huidige beleid betekent tegen de leeftijd waarop je minder of niet meer actief wilt werken.'],
  ['Dag 3', 'Activaklassen en allocatie', 'Je beoordeelt twaalf activaklassen volgens risico, rendement, liquiditeit, fiscaliteit, tijd en complexiteit.'],
  ['Dag 4', 'Jouw vermogensplan', 'Je draait scenario’s, maakt keuzes en legt vast wat er de komende twaalf maanden en daarna moet gebeuren.'],
]

const testimonials = [
  {
    id: '1234030300',
    title: 'Van losse cijfers naar één duidelijk overzicht',
    person: 'Deelnemer Invest Masterclass',
    context: 'Ondernemer met vermogen in privé en vennootschap',
  },
  {
    id: '1234030322',
    title: 'Eindelijk een volgorde in de financiële beslissingen',
    person: 'Deelnemer Invest Masterclass',
    context: 'Zocht structuur voor vastgoed, cash en beleggingen',
  },
  {
    id: '1234030337',
    title: 'Van uitstellen naar een plan dat uitvoerbaar is',
    person: 'Deelnemer Invest Masterclass',
    context: 'Bouwde tijdens vier dagen een eigen vermogensplan',
  },
]

const reviews = [
  ['/testimonials/delphine-van-loocke.png', 'Review van Delphine Van Loocke'],
  ['/testimonials/thomas-driessen.png', 'Review van Thomas Driessen'],
  ['/testimonials/yasmine-kustermans.png', 'Review van Yasmine Kustermans'],
  ['/testimonials/sigurd-staelens.png', 'Review van Sigurd Staelens'],
  ['/testimonials/wilmer-v.png', 'Review van Wilmer V'],
  ['/testimonials/t-k.png', 'Review van T K'],
]

const fits = [
  'Ondernemer bent of vermogen hebt opgebouwd via een vennootschap',
  'Cash, vastgoed, beleggingen en pensioen niet als één geheel bekijkt',
  'Niet afhankelijk wilt blijven van losse meningen van bankier, boekhouder of internet',
  'Een concrete beslissing uitstelt omdat je het totaalplaatje niet ziet',
  'Bereid bent om vier dagen met je eigen cijfers te werken',
  'Naar huis wilt gaan met een plan, niet alleen met kennis',
]

const notFits = [
  'Snel wilt traden of een “hot tip” zoekt',
  'Een gegarandeerd rendement verwacht',
  'Geen eigen cijfers wilt meebrengen',
  'Alleen algemene informatie wilt consumeren',
  'Verwacht dat Archer jouw boekhouder, bankier of fiscalist vervangt',
  'Niet bereid bent om beslissingen te nemen',
]

const faqs = [
  ['Moet ik nu betalen?', 'Nee. Je kiest eerst je voorkeursdatum. Daarna bespreekt iemand van ons team je situatie met je. De kandidaatstelling is geen betaling en verplicht je niet tot deelname.'],
  ['Wat moet ik meebrengen?', 'Je relevante cijfers: jaarrekening, kredieten, beleggingsoverzicht, vastgoedgegevens, cashpositie en andere informatie die nodig is om je situatie te begrijpen.'],
  ['Is dit beleggingsadvies?', 'De Masterclass is educatief en helpt je om je financiële situatie en keuzes beter te begrijpen. Concrete beslissingen moeten worden bekeken binnen de toepasselijke regelgeving en met bevoegde professionals waar nodig.'],
  ['Is dit voor beginners?', 'Je hoeft geen expert te zijn. Je moet wel bereid zijn om met je eigen cijfers te werken en beslissingen te nemen.'],
  ['Is dit alleen voor ondernemers?', 'De Masterclass is vooral ontworpen voor ondernemers en mensen met een complexer vermogen, waaronder privévermogen, vennootschap, vastgoed en beleggingen.'],
  ['Wat gebeurt er nadat ik een datum kies?', 'Je wordt gecontacteerd door iemand van ons team. We bespreken je huidige situatie, wat je wilt bereiken en of de vier dagen daar het juiste antwoord op zijn.'],
]

function VimeoTestimonial({ testimonial, index }: { testimonial: (typeof testimonials)[number]; index: number }) {
  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="relative aspect-[4/3] bg-muted">
        <iframe
          src={`https://player.vimeo.com/video/${testimonial.id}?badge=0&autopause=1&title=0&byline=0&portrait=0&dnt=1`}
          title={`Testimonial ${index + 1}: ${testimonial.title}`}
          allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          loading="lazy"
          allowFullScreen
          className="absolute inset-0 size-full border-0"
        />
      </div>
      <div className="p-5 sm:p-6">
        <h3 className="text-pretty text-lg font-semibold tracking-tight text-foreground">{testimonial.title}</h3>
        <p className="mt-3 text-sm font-medium text-foreground">{testimonial.person}</p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{testimonial.context}</p>
      </div>
    </article>
  )
}

function TestimonialSpotlight({ index }: { index: number }) {
  return (
    <div className="mx-auto max-w-3xl">
      <VimeoTestimonial testimonial={testimonials[index]} index={index} />
    </div>
  )
}

export default function MasterclassDecisionContent({ children }: { children: React.ReactNode }) {
  const dateSectionRef = useRef<HTMLElement>(null)

  function scrollToDates() {
    dateSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <main className="font-sans">
      <section className="border-b border-border bg-background px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-5xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">Invest Masterclass</p>
          <h1 className="mt-5 max-w-4xl text-balance text-4xl font-semibold tracking-[-0.045em] text-foreground sm:text-6xl sm:leading-[1.05]">
            Je hebt gezien wat er moet veranderen. Nu bouw je jouw eigen vermogensplan.
          </h1>
          <p className="mt-7 max-w-3xl text-pretty text-lg leading-8 text-muted-foreground sm:text-xl">
            Tijdens de Invest Masterclass breng je je privévermogen, vennootschap, vastgoed, cash en beleggingen samen in één overzicht. Je gaat naar huis met duidelijke scenario’s, een beslissingsvolgorde en een plan dat je zelf begrijpt.
          </p>
          <div className="mt-8 flex flex-col gap-5 sm:flex-row sm:items-center">
            <button type="button" onClick={scrollToDates} className="inline-flex min-h-12 items-center justify-center rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
              Bekijk de edities
            </button>
            <p className="text-sm font-medium text-foreground">Vier dagen live in Antwerpen. Met jouw eigen cijfers.</p>
          </div>
        </div>
      </section>

      <section className="px-4 py-14 sm:px-6 sm:py-20" aria-labelledby="proof-title">
        <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Van theorie naar jouw realiteit</p>
            <h2 id="proof-title" className="mt-3 text-balance text-3xl font-semibold tracking-[-0.035em] text-foreground sm:text-4xl">Zo wordt versnipperd vermogen een concreet plan.</h2>
            <p className="mt-5 text-pretty text-base leading-7 text-muted-foreground">Na de zes video’s weet je wat GGR is. Tijdens de Masterclass bereken je jouw GGR, ontdek je welk deel van je vermogen eerst moet verschuiven en bepaal je welke beslissing als eerste komt.</p>
          </div>
          <div className="rounded-2xl border border-primary/15 bg-primary/[0.05] p-6 sm:p-8">
            <p className="text-sm font-semibold text-primary">Eén financiële realiteit</p>
            <div className="mt-5 grid grid-cols-2 gap-3 text-sm text-foreground">
              {['Privévermogen', 'Vennootschap', 'Vastgoed', 'Cash', 'Beleggingen', 'Kredieten'].map(item => <span key={item} className="rounded-lg border border-border bg-background px-3 py-3">{item}</span>)}
            </div>
            <p className="mt-5 text-sm leading-6 text-muted-foreground">Geen losse productmening, wel jouw volledige situatie samengebracht zodat je zelf een verdedigbare volgende stap kunt kiezen.</p>
          </div>
        </div>
      </section>

      <section className="px-4 pb-16 sm:px-6 sm:pb-24" aria-label="Ervaring van een deelnemer"><TestimonialSpotlight index={0} /></section>

      <section className="border-y border-border bg-muted/35 px-4 py-16 sm:px-6 sm:py-24" aria-labelledby="outcomes-title">
        <div className="mx-auto max-w-5xl">
          <h2 id="outcomes-title" className="max-w-3xl text-balance text-3xl font-semibold tracking-[-0.035em] text-foreground sm:text-4xl">Je gaat niet naar huis met meer informatie. Je gaat naar huis met beslissingen.</h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {outcomes.map(([title, text], index) => (
              <article key={title} className={`rounded-2xl border border-border bg-background p-6 ${index === outcomes.length - 1 ? 'sm:col-span-2 lg:col-span-1' : ''}`}>
                <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">{index + 1}</span>
                <h3 className="mt-5 text-lg font-semibold text-foreground">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 sm:py-24" aria-labelledby="days-title">
        <div className="mx-auto max-w-5xl">
          <h2 id="days-title" className="text-balance text-3xl font-semibold tracking-[-0.035em] text-foreground sm:text-4xl">Van versnipperde potjes naar één verdedigbaar plan.</h2>
          <div className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-2">
            {days.map(([day, title, text]) => (
              <article key={day} className="bg-background p-6 sm:p-8">
                <p className="text-sm font-semibold text-primary">{day}</p>
                <h3 className="mt-2 text-xl font-semibold text-foreground">{title}</h3>
                <p className="mt-4 text-sm leading-6 text-muted-foreground">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 pb-16 sm:px-6 sm:pb-24" aria-label="Ervaring van een deelnemer"><TestimonialSpotlight index={1} /></section>

      <section className="border-y border-border bg-muted/35 px-4 py-16 sm:px-6 sm:py-24" aria-labelledby="reviews-title">
        <div className="mx-auto max-w-6xl">
          <h2 id="reviews-title" className="max-w-3xl text-balance text-3xl font-semibold tracking-[-0.035em] text-foreground sm:text-4xl">Beoordeeld door mensen die al met hun eigen cijfers aan de slag gingen.</h2>
          <div className="mt-9 flex snap-x snap-mandatory gap-5 overflow-x-auto pb-4" aria-label="Trustpilot-reviews">
            {reviews.map(([src, alt]) => (
              <figure key={src} className="w-[82vw] max-w-md shrink-0 snap-start overflow-hidden rounded-2xl border border-border bg-card sm:w-[45vw] lg:w-[31%]">
                <Image src={src} alt={alt} width={1920} height={1278} className="h-auto w-full" sizes="(max-width: 640px) 82vw, (max-width: 1024px) 45vw, 31vw" />
              </figure>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-2">
          <article className="rounded-2xl border border-border bg-background p-6 sm:p-8">
            <h2 className="text-balance text-2xl font-semibold tracking-tight text-foreground">Deze vier dagen zijn voor jou als je…</h2>
            <ul className="mt-6 flex flex-col gap-4">{fits.map(item => <li key={item} className="flex gap-3 text-sm leading-6 text-muted-foreground"><Check className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />{item}</li>)}</ul>
          </article>
          <article className="rounded-2xl border border-border bg-muted/35 p-6 sm:p-8">
            <h2 className="text-balance text-2xl font-semibold tracking-tight text-foreground">Dit is niet voor jou als je…</h2>
            <ul className="mt-6 flex flex-col gap-4">{notFits.map(item => <li key={item} className="flex gap-3 text-sm leading-6 text-muted-foreground"><CircleX className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />{item}</li>)}</ul>
          </article>
        </div>
      </section>

      <section className="border-y border-border bg-foreground px-4 py-16 text-background sm:px-6 sm:py-24" aria-labelledby="price-title">
        <div className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-[1fr_0.8fr] lg:items-start">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Investering</p>
            <h2 id="price-title" className="mt-3 text-balance text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">Een plan voor de rest van je financiële leven.</h2>
            <p className="mt-5 text-lg leading-8 text-background/70">De investering voor de vierdaagse Invest Masterclass bedraagt <strong className="font-semibold text-background">€6.200 exclusief btw</strong>.</p>
            <ul className="mt-7 grid gap-3 sm:grid-cols-2">
              {['Vier volledige live dagen', 'De Archer Vermogensplanner', 'Je persoonlijke financiële projectie', 'Je GGR en vermogensverdeling', 'Drie maanden implementatiebegeleiding', 'Drie persoonlijke opvolggesprekken', 'Toegang tot de groep en het netwerk'].map(item => <li key={item} className="flex gap-3 text-sm leading-6 text-background/75"><Check className="mt-1 size-4 shrink-0 text-primary" aria-hidden="true" />{item}</li>)}
            </ul>
          </div>
          <aside className="rounded-2xl border border-background/15 bg-background/5 p-6 sm:p-8">
            <ShieldCheck className="size-7 text-primary" aria-hidden="true" />
            <h3 className="mt-5 text-xl font-semibold">Beslis met ervaring, niet met druk.</h3>
            <p className="mt-4 text-sm leading-7 text-background/70">Na dag twee kun je beoordelen of dit de juiste omgeving voor jou is. Als je niet tevreden bent volgens de voorwaarden van de garantie, krijg je je investering terug.</p>
          </aside>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 sm:py-24" aria-label="Ervaring van een deelnemer"><TestimonialSpotlight index={2} /></section>

      <section ref={dateSectionRef} className="scroll-mt-6 border-y border-border bg-muted/35 px-4 py-16 sm:px-6 sm:py-24" aria-label="Kies je editie">
        <div className="mx-auto max-w-5xl">{children}</div>
      </section>

      <section className="px-4 py-16 sm:px-6 sm:py-24" aria-labelledby="faq-title">
        <div className="mx-auto max-w-3xl">
          <h2 id="faq-title" className="text-balance text-3xl font-semibold tracking-[-0.035em] text-foreground sm:text-4xl">Veelgestelde vragen</h2>
          <div className="mt-8 divide-y divide-border border-y border-border">
            {faqs.map(([question, answer]) => (
              <details key={question} className="group py-5">
                <summary className="cursor-pointer list-none pr-8 text-base font-semibold text-foreground marker:content-none">{question}</summary>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">{answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}
