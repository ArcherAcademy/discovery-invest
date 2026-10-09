'use client'

import Link from 'next/link'

const SECTION_IMAGE_URL =
  'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-D5JUqCAmoMABozwaKCdsnqikA5hcr7.png'

export function HomeParticipantExperiences() {
  return (
    <section aria-label="Ervaringen van deelnemers" className="relative overflow-hidden bg-background">
      <img
        src={SECTION_IMAGE_URL}
        alt="Ervaringen van deelnemers na vier dagen Archer Masterclass, met video en Trustpilot-beoordelingen"
        width={777}
        height={1032}
        className="block h-auto w-full"
      />

      <Link
        href="/masterclass"
        aria-label="Bekijk de ervaringen van deelnemers"
        className="absolute left-[43%] top-[29%] h-[7%] w-[14%] rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      />

      <a
        href="https://www.trustpilot.com/review/archer.academy"
        target="_blank"
        rel="noreferrer"
        aria-label="Lees alle ervaringen op Trustpilot"
        className="absolute bottom-[3.5%] left-[31%] h-[4%] w-[38%] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      />
    </section>
  )
}
