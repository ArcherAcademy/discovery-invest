'use client'

import Image from 'next/image'
import { CheckCircle2, ArrowRight, Calendar, Users } from 'lucide-react'
import { useApp } from '@/components/app-context'
import { t } from '@/lib/i18n'

const DAYS = [
  {
    tag: 'Bewustwording & fundament',
    title: 'Dag 1 · We brengen je situatie in kaart',
    desc: 'Samen leggen we bloot waar je vermogen vandaag écht staat. Privé of via een vennootschap: vastgoed, beleggingen, verzekeringen. Niet wat je denkt, maar hoe het echt is.',
    result: 'Je persoonlijke vermogensfoto op papier.',
  },
  {
    tag: 'Fiscaliteit & strategie',
    title: 'Dag 2 · We maken fiscaliteit je medestander',
    desc: 'We tonen je hoe jouw situatie fiscaal eruitziet, of je nu in loondienst bent, zelfstandige, of met een vennootschap werkt, en bouwen samen aan een concrete pensioenprojectie.',
    result: 'De fiscale routes die voor jou relevant zijn.',
  },
  {
    tag: 'Strategie & actie',
    title: 'Dag 3 · We bouwen je beleggingsstrategie',
    desc: 'We helpen je een portefeuille bouwen die je begrijpt en volhoudt: spreiding, kosten, timing, ETFs, en waarom gedrag meer bepaalt dan productkeuze.',
    result: 'De eerste versie van je eigen strategie.',
  },
  {
    tag: 'Toekomst & plan',
    title: 'Dag 4 · We zetten alles om in jouw plan',
    desc: 'Alles van de voorbije dagen komt samen in één plan met een horizon van tien jaar en verder. We bepalen samen welke beslissingen je dit kwartaal al neemt.',
    result: 'Je vermogensplan en je eerste drie acties.',
  },
]

const STATS = [
  { value: '€25 mln', label: 'omzet in 6 jaar' },
  { value: 'FSMA', label: 'geregistreerd sinds 2025' },
  { value: '€24 mln', label: 'toegevoegd beheerd vermogen' },
  { value: 'Lannoo', label: 'boek begin 2027' },
]

const PROBLEMS = [
  'Je spaargeld staat stil terwijl de inflatie doorloopt',
  'Je hebt losse producten verzameld maar geen geheel',
  'Je vermogen staat nergens op papier als één plan',
  'Advies komt altijd van iemand die er zelf aan verdient',
  'Je weet dat je iets moet doen, alleen niet wat eerst',
]


const COBALT = '#2500F5'

export default function MasterclassPage() {
  const { locale } = useApp()
  const tr = t(locale)

  const CTA_URL = 'https://archerinvest.be/#wachtlijst'

  return (
    <div className="max-w-3xl mx-auto space-y-16 pb-20">

      {/* ── HERO ─────────────────────────────────────────────── */}
      <section className="relative rounded-3xl overflow-hidden" style={{ minHeight: 340 }}>
        <Image
          src="/masterclass/mc-zaal.jpg"
          alt="Archer Invest Masterclass — deelnemers in gotische zaal rond werktafel"
          fill
          className="object-cover object-center"
          priority
        />
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(to right, rgba(13,15,20,0.82) 50%, rgba(13,15,20,0.35))' }}
        />
        <div className="relative z-10 px-10 py-12 flex flex-col justify-end h-full" style={{ minHeight: 340 }}>
          <p className="text-xs font-bold tracking-[0.18em] mb-3" style={{ color: 'rgba(255,255,255,0.55)' }}>
            INVEST MASTERCLASS · VIER DAGEN
          </p>
          <h1 className="text-4xl font-extrabold leading-tight text-white mb-1 text-balance">
            Je verdient goed.<br />
            <span style={{ color: COBALT }}>Je vermogen groeit nog niet mee.</span>
          </h1>
          <p className="text-sm leading-relaxed mt-3 mb-6 max-w-md" style={{ color: 'rgba(255,255,255,0.7)' }}>
            Vier dagen waarin je je volledige financiële situatie doorlicht, fiscaliteit leert gebruiken als hefboom, en vertrekt met een vermogensplan dat van jou is, of je nu particulier spaart of via een vennootschap werkt.
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            <a
              href={CTA_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-bold px-6 py-3 rounded-full transition-all hover:opacity-90"
              style={{ background: COBALT, color: '#fff' }}
            >
              Kom op de wachtlijst <ArrowRight size={15} />
            </a>
            <span className="text-xs font-medium px-3 py-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.8)' }}>
              Editie september 2026 · nog 19% beschikbaar
            </span>
          </div>
        </div>
      </section>

      {/* ── PROBLEEM ─────────────────────────────────────────── */}
      <section className="grid md:grid-cols-2 gap-8 items-center">
        <div>
          <p className="text-xs font-bold tracking-[0.15em] mb-3" style={{ color: COBALT }}>HET PROBLEEM</p>
          <h2 className="text-2xl font-extrabold leading-tight mb-3 text-balance" style={{ color: '#0d0f14' }}>
            Je inkomen is geregeld.<br />
            <span style={{ color: COBALT }}>Je vermogen heeft nog geen systeem.</span>
          </h2>
          <p className="text-sm leading-relaxed mb-5" style={{ color: 'rgba(13,15,20,0.6)' }}>
            De meesten onder ons bouwen goed salaris of omzet op. Maar voor hun vermogen bestaat er geen plan: enkel losse beslissingen, advies van mensen die er belang bij hebben, en het gevoel dat het anders kan.
          </p>
          <ul className="space-y-2.5">
            {PROBLEMS.map((p) => (
              <li key={p} className="flex items-start gap-2.5 text-sm" style={{ color: '#0d0f14' }}>
                <CheckCircle2 size={15} className="mt-0.5 shrink-0" style={{ color: COBALT }} />
                {p}
              </li>
            ))}
          </ul>
        </div>
        <div className="relative rounded-2xl overflow-hidden aspect-[3/4]">
          <Image src="/masterclass/mc-gilles.jpg" alt="Archer Masterclass: spreker overhandigt microfoon aan deelnemer Gilles S." fill className="object-cover object-center" />
        </div>
      </section>

      {/* ── CTA 1 ────────────────────────────────────────────── */}
      <section
        className="rounded-2xl px-8 py-7 flex flex-col sm:flex-row items-center justify-between gap-5"
        style={{ background: COBALT }}
      >
        <div>
          <p className="text-sm font-bold text-white mb-0.5">Klaar om je vermogen een systeem te geven?</p>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.65)' }}>Editie september 2026 · beperkt aantal plaatsen</p>
        </div>
        <a
          href={CTA_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="whitespace-nowrap inline-flex items-center gap-2 text-sm font-bold px-6 py-3 rounded-full transition-all hover:opacity-90 shrink-0"
          style={{ background: '#fff', color: COBALT }}
        >
          Kom op de wachtlijst <ArrowRight size={14} />
        </a>
      </section>

      {/* ── VIER DAGEN ───────────────────────────────────────── */}
      <section>
        <p className="text-xs font-bold tracking-[0.15em] mb-2" style={{ color: COBALT }}>ZO BEGELEIDEN WE JE</p>
        <h2 className="text-2xl font-extrabold mb-1" style={{ color: '#0d0f14' }}>
          Vier dagen. <span style={{ color: COBALT }}>Eén systeem.</span>
        </h2>
        <p className="text-sm mb-8" style={{ color: 'rgba(13,15,20,0.55)' }}>
          Dit is geen theorie uit een handboek. Het is hoe wij jou, met je eigen cijfers, in vier dagen van inzicht naar een afgewerkt vermogensplan begeleiden.
        </p>
        <div className="space-y-4">
          {DAYS.map((day, i) => (
            <div
              key={i}
              className="rounded-2xl p-6 flex gap-5"
              style={{ background: '#fff', border: '1px solid #e8ecf4' }}
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-extrabold text-white shrink-0 mt-0.5"
                style={{ background: COBALT }}
              >
                {i + 1}
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-bold tracking-widest uppercase mb-1" style={{ color: 'rgba(13,15,20,0.38)' }}>
                  {day.tag}
                </p>
                <h3 className="text-sm font-bold mb-1.5" style={{ color: '#0d0f14' }}>{day.title}</h3>
                <p className="text-xs leading-relaxed mb-3" style={{ color: 'rgba(13,15,20,0.6)' }}>{day.desc}</p>
                <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: COBALT }}>
                  <CheckCircle2 size={12} />
                  Je vertrekt met: {day.result}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── BEGELEIDER ───────────────────────────────────────── */}
      <section className="grid md:grid-cols-2 gap-8 items-center">
        <div className="relative rounded-2xl overflow-hidden aspect-[3/4]">
          <Image src="/masterclass-begeleider.jpg" alt="Anthony Swolfs op het podium bij de Archer Masterclass" fill className="object-cover object-center" />
        </div>
        <div>
          <p className="text-xs font-bold tracking-[0.15em] mb-3" style={{ color: COBALT }}>JE BEGELEIDER</p>
          <h2 className="text-2xl font-extrabold leading-tight mb-3 text-balance" style={{ color: '#0d0f14' }}>
            €660.000 verloren op zijn 23ste.<br />
            <span style={{ color: COBALT }}>Daar begon dit verhaal.</span>
          </h2>
          <p className="text-sm leading-relaxed mb-4" style={{ color: 'rgba(13,15,20,0.6)' }}>
            Anthony Swolfs bouwde in zes jaar een groep uit met meer dan €25 miljoen omzet. Maar de les die deze masterclass vorm gaf was geen succes: op zijn drieëntwintigste verloor hij €660.000 aan crypto. Geld dat hij bijeenspaarde en kwijtspeelde als belegger, omdat hij geen systeem had, alleen overtuiging.
          </p>
          <p className="text-sm leading-relaxed mb-5" style={{ color: 'rgba(13,15,20,0.6)' }}>
            Sindsdien bouwt hij dat systeem, eerst voor zichzelf, daarna publiek. In 2025 behaalde hij zijn FSMA registratie. Begin 2026 lanceerde hij het Archer Investment Fund.
          </p>
          <div className="grid grid-cols-2 gap-3 mb-5">
            {STATS.map((s) => (
              <div key={s.label} className="rounded-xl px-4 py-3" style={{ background: '#f0f3fb' }}>
                <p className="text-base font-extrabold" style={{ color: COBALT }}>{s.value}</p>
                <p className="text-xs" style={{ color: 'rgba(13,15,20,0.55)' }}>{s.label}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <a
              href={CTA_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 text-sm font-bold px-6 py-3 rounded-full transition-all hover:opacity-90"
              style={{ background: COBALT, color: '#fff' }}
            >
              Kom op de wachtlijst <ArrowRight size={14} />
            </a>
            <a
              href="https://archerinvest.be/contact"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 text-sm font-semibold px-6 py-3 rounded-full transition-all hover:opacity-90"
              style={{ background: '#fff', color: '#0d0f14', border: '1px solid #e8ecf4' }}
            >
              Stel een vraag <ArrowRight size={14} />
            </a>
          </div>
        </div>
      </section>

      {/* ── PODCAST ──────────────────────────────────────────── */}
      <section className="flex items-center justify-between gap-4 px-5 py-4 rounded-2xl" style={{ background: '#f8f9fc', border: '1px solid #e8ecf4' }}>
        <p className="text-xs font-semibold" style={{ color: 'rgba(13,15,20,0.45)' }}>
          Luister ook onze podcast
        </p>
        <div className="flex items-center gap-2 shrink-0">
          {/* Spotify */}
          <a
            href="https://open.spotify.com/show/0TFOqmT7obSGBDG035njL8"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-full transition-all hover:opacity-80"
            style={{ background: '#1DB954', color: '#fff' }}
          >
            {/* Spotify logo */}
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
            </svg>
            Beluister op Spotify
          </a>
          {/* YouTube */}
          <a
            href="https://www.youtube.com/watch?v=Yw8LXLRVllU&list=PLjiVHbXlNlOYU16vXC--yt6EmyFmwlE9o"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-full transition-all hover:opacity-80"
            style={{ background: '#FF0000', color: '#fff' }}
          >
            {/* YouTube logo */}
            <svg width="14" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
            </svg>
            Bekijk op YouTube
          </a>
        </div>
      </section>

      {/* ── PAST EDITIONS ────────────────────────────────────── */}
      <section>
        <p className="text-xs font-bold tracking-[0.15em] mb-2" style={{ color: COBALT }}>AFGELOPEN EDITIES</p>
        <h2 className="text-xl font-extrabold mb-6" style={{ color: '#0d0f14' }}>
          Elke editie was volgeboekt.
        </h2>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Editie december 2025', img: '/masterclass/mc-publiek.jpg',  alt: 'Deelnemers luisteren aandachtig tijdens Archer Masterclass editie december 2025' },
            { label: 'Editie februari 2026', img: '/masterclass/mc-podium.jpg',   alt: 'Spreker op podium voor Archer backdrop in gotische zaal, editie februari 2026' },
            { label: 'Editie juni 2026',     img: '/masterclass/mc-diner.jpg',    alt: 'Netwerk­diner bij kaarslicht na Archer Masterclass editie juni 2026' },
          ].map((ed, i) => (
            <div key={i} className="rounded-2xl overflow-hidden" style={{ border: '1px solid #e8ecf4' }}>
              {/* Portrait aspect ratio — keeps vertical photos fully visible */}
              <div className="relative aspect-[3/4]">
                <Image
                  src={ed.img}
                  alt={ed.alt}
                  fill
                  className="object-cover object-center"
                />
              </div>
              <div className="px-4 py-3">
                <p className="text-xs font-semibold" style={{ color: '#0d0f14' }}>{ed.label}</p>
                <span className="text-[10px] font-bold tracking-widest" style={{ color: COBALT }}>VOLGEBOEKT</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FINAL CTA ────────────────────────────────────────── */}
      <section
        className="rounded-3xl overflow-hidden relative"
        style={{ background: '#0d0f14', minHeight: 200 }}
      >
        <div className="absolute inset-0 opacity-20">
          <Image src="/masterclass/mc-hall.jpg" alt="" fill className="object-cover object-top" />
        </div>
        <div className="relative z-10 px-10 py-12 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Calendar size={14} style={{ color: 'rgba(255,255,255,0.5)' }} />
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>September 2026</span>
            </div>
            <h2 className="text-2xl font-extrabold text-white text-balance">
              Klaar om je vermogen een systeem te geven?
            </h2>
            <p className="text-sm mt-2" style={{ color: 'rgba(255,255,255,0.55)' }}>
              Nog 19% van de plaatsen beschikbaar. Plan een gesprek of kom op de wachtlijst.
            </p>
          </div>
          <div className="flex flex-col gap-3 shrink-0">
            <a
              href={CTA_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-bold px-6 py-3 rounded-full transition-all hover:opacity-90 whitespace-nowrap"
              style={{ background: COBALT, color: '#fff' }}
            >
              Kom op de wachtlijst <ArrowRight size={14} />
            </a>
            <a
              href="https://archerinvest.be/contact"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 text-sm font-semibold px-6 py-3 rounded-full transition-all hover:opacity-90 whitespace-nowrap"
              style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.15)' }}
            >
              Plan een gesprek <Users size={13} />
            </a>
          </div>
        </div>
      </section>

    </div>
  )
}
