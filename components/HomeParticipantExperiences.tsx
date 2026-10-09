'use client'

import { useRef, useState } from 'react'
import { ExternalLink, Play, Star } from 'lucide-react'

const testimonials = [
  ['5efba97f-e2c7-4764-92e8-ed28998d1a2d/decision-testimonial-1-hq.jpg', 'c1b71664-3aad-4b92-ac36-69832d800000/testimonial-1.mp4'],
  ['596e3ba0-1db4-416a-b3a5-43fed16463fe/decision-testimonial-2-hq.jpg', '72bb5297-2318-4fd5-9c2c-92aaee0e9ddf/testimonial-2.mp4'],
  ['eb51910d-b532-4261-9465-c51c93cb7786/decision-testimonial-3-hq.jpg', 'a6772dd2-2e8a-40b2-a651-d279dffa4174/testimonial-3.mp4'],
  ['4e4ce3f4-7ec7-4b64-870a-cfd69e6d62d7/decision-testimonial-sonja-hq.jpg', 'e22ddef5-e233-499b-a6d4-fcb135dd0dd6/testimonial-sonja.mp4'],
  ['4b84eeba-9bf1-49f3-b245-3d400bd4dc46/decision-testimonial-nick-hq.jpg', '9801d34c-4a13-4eb4-9f76-a0ff78c23adf/testimonial-nick.mp4'],
  ['decc45fc-f731-4e17-8d4a-76978749c565/decision-testimonial-joost-hq.jpg', '87092252-5e74-47af-bf40-0f0e9c67e293/testimonial-joost.mp4'],
  ['7a88b781-f997-47af-800f-f3ac143cbb0d/decision-testimonial-jelle-hq.jpg', 'f5f65b2e-3af7-4de5-a5b9-e833c87d9122/testimonial-jelle.mp4'],
  ['ceef6079-29bd-4349-8e2c-115ec1fde487/decision-testimonial-jeanine-hq.jpg', '7a013fb3-999b-4d67-8b63-3e2445ba695a/testimonial-jeanine.mp4'],
  ['5f5de56e-4647-4fc2-9fa0-50f799f041b8/decision-testimonial-christophe-hq.jpg', 'f1e2ac9e-124d-4f3d-877a-c011dbfa459d/testimonial-christophe.mp4'],
  ['dfd3ec96-390b-46b9-b07a-5133b23d9a99/decision-testimonial-cedric-hq.jpg', '968db26b-8d9d-496f-9645-95b31135a684/testimonial-cedric.mp4'],
  ['7174e88e-58af-424b-a881-20fec61a9995/decision-testimonial-cedric_s-hq.jpg', 'd580d75e-7a39-4c82-93ce-c237851b029b/testimonial-cedric_s.mp4'],
  ['ad1cbdc1-ded7-44fc-b9fa-01a59221934f/decision-testimonial-bram-hq.jpg', 'f56934bb-b505-49da-a0e3-e84230d920c3/testimonial-bram.mp4'],
  ['b9bbac84-03f7-4d44-8e43-d5cae23448ef/decision-testimonial-bert-hq.jpg', '1c92380f-b44a-4ae4-b47d-1283e7a24f18/testimonial-bert.mp4'],
  ['351b334c-8368-429b-9060-2dcff2b12dc5/decision-testimonial-arno-hq.jpg', '9210058b-3a2b-48f1-a96c-2c7d425974ed/testimonial-arno.mp4'],
].map(([poster, video]) => ({
  poster: `https://archerinvest.be/__l5e/assets-v1/${poster}`,
  video: `https://archerinvest.be/__l5e/assets-v1/${video}`,
}))

const reviews = [
  { initial: 'N', name: 'Nicolas De Smet', date: 'juni 2026', title: 'Begin liever gisteren dan morgen', text: 'Met bijzonder veel plezier beveel ik het Archer Invest-traject aan iedere ondernemer aan.' },
  { initial: 'B', name: 'Brent Mouton', date: 'februari 2026', title: 'Waardevolle 4-daagse', text: 'Ik ben 31 jaar. De beslissingen die ik nu kan nemen gaan een heel grote impact maken op mijn toekomst als ondernemer-investeerder.' },
  { initial: 'M', name: 'Marcel Hugers', date: 'februari 2026', title: 'Krachtige masterclass', text: 'Krachtige masterclass om inzicht te krijgen in je huidige financiële status. Voldoende informatie om actief te starten met vermogensopbouw.' },
  { initial: 'T', name: 'Thomas Bossuyt', date: 'februari 2026', title: 'Financieel businessplan van je privésituatie', text: 'Net een heel interessante masterclass achter de rug. Blij dat ik deze gevolgd heb, het zal mij zeker geld opgebracht hebben.' },
  { initial: 'J', name: 'Jan L', date: 'februari 2026', title: 'Zeer inspirerende masterclass', text: 'Zeer inspirerende masterclass met nieuwe inzichten die direct toepasbaar zijn.' },
  { initial: 'A', name: 'Alexander', date: 'juni 2026', title: 'Archer Masterclass Juni 2026', text: 'Bijzonder waardevolle ervaring. Sprekers deelden niet alleen kennis, maar concrete strategieën die onmiddellijk bruikbaar zijn.' },
]

function Stars() {
  return <span aria-label="5 van 5 sterren" className="flex gap-0.5">{Array.from({ length: 5 }, (_, index) => <span key={index} className="flex size-4 items-center justify-center bg-[#00b67a] text-white"><Star className="size-2.5 fill-current" /></span>)}</span>
}

export function HomeParticipantExperiences() {
  const [selected, setSelected] = useState(0)
  const [playing, setPlaying] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const active = testimonials[selected]

  function selectTestimonial(index: number) {
    setSelected(index)
    setPlaying(false)
  }

  async function playVideo() {
    setPlaying(true)
    await videoRef.current?.play()
  }

  return (
    <section aria-labelledby="participant-experiences-title" className="overflow-hidden rounded-2xl bg-white px-5 py-14 text-[#211334] sm:px-10 sm:py-20">
      <header className="mx-auto max-w-4xl text-center">
        <p className="mb-3 text-[11px] font-bold uppercase tracking-wide text-[#1111ee]">Ervaringen van deelnemers</p>
        <h2 id="participant-experiences-title" className="text-balance text-3xl font-bold leading-[1.02] tracking-tight sm:text-5xl">
          Dit is wat deelnemers na vier dagen <span className="text-[#1111ee]">anders zien, beslissen en doen.</span>
        </h2>
      </header>

      <div className="mx-auto mt-8 w-[214px] overflow-hidden rounded-lg bg-[#e8e8e8] sm:w-[258px]">
        <div className="relative aspect-[9/16]">
          <video key={active.video} ref={videoRef} src={active.video} poster={active.poster} controls={playing} playsInline preload="metadata" aria-label={`Ervaring van deelnemer ${selected + 1}`} className="size-full object-cover" />
          {!playing ? <button type="button" onClick={playVideo} aria-label={`Afspelen: Ervaring van deelnemer ${selected + 1}`} className="absolute inset-0 flex items-center justify-center"><span className="flex size-14 items-center justify-center rounded-full bg-white text-[#211334] shadow-lg"><Play className="ml-1 size-5 fill-current" /></span></button> : null}
        </div>
      </div>

      <div role="group" aria-label="Kies een testimonial" className="mx-auto mt-5 flex max-w-2xl gap-2 overflow-x-auto pb-2">
        {testimonials.map((testimonial, index) => <button key={testimonial.poster} type="button" onClick={() => selectTestimonial(index)} aria-label={`Bekijk testimonial ${index + 1}`} aria-pressed={selected === index} className={`relative aspect-[3/4] min-w-8 overflow-hidden rounded-md transition ${selected === index ? 'ring-2 ring-[#1111ee] ring-offset-2' : 'opacity-75 hover:opacity-100'}`}><img src={testimonial.poster} alt="" className="size-full object-cover" /></button>)}
      </div>

      <div aria-label="Ervaringen van deelnemers" className="mx-auto mt-8 grid max-w-5xl gap-0 sm:grid-cols-3">
        {reviews.map((review, index) => <article key={review.name} className={`relative rounded-xl border border-[#dde1e7] bg-white p-5 shadow-[0_16px_35px_rgba(28,29,40,0.10)] sm:min-h-52 ${index % 3 === 0 ? 'sm:rotate-[-2deg]' : index % 3 === 2 ? 'sm:rotate-[2deg]' : ''} ${index >= 3 ? 'sm:-mt-1' : ''}`}>
          <div className="flex items-start gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#11151c] text-sm font-semibold text-white">{review.initial}</span><div className="min-w-0 flex-1"><p className="text-sm font-semibold leading-tight">{review.name}</p><p className="text-[11px] leading-tight text-[#697386]">{review.date} · Trustpilot</p></div><Stars /></div>
          <h3 className="mt-4 text-sm font-semibold">{review.title}</h3><p className="mt-3 text-sm leading-6 text-[#697386]">{review.text}</p>
        </article>)}
      </div>

      <div className="mt-10 text-center"><a href="https://www.trustpilot.com/review/archer.academy" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-[#1111ee] hover:underline">Lees alle ervaringen op Trustpilot <ExternalLink className="size-3" /></a><p className="mt-3 text-[11px] text-[#7b8190]">Persoonlijke ervaringen. Resultaten verschillen per deelnemer.</p></div>
    </section>
  )
}
