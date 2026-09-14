import type { Metadata } from 'next'
import { Sparkles } from 'lucide-react'
import { MeetingsEmbed } from '@/components/adviesgesprek/MeetingsEmbed'

export const metadata: Metadata = {
  title: 'Plan je adviesgesprek | Archer Invest',
  description: 'Plan je persoonlijke adviesgesprek met Archer Invest.',
}

export default function AdviesgesprekPage() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 pb-16">
      <header className="flex max-w-2xl flex-col gap-4 pt-2 sm:pt-6">
        <div className="flex w-fit items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-primary">
          <Sparkles size={13} aria-hidden="true" />
          Exclusief voor jou vrijgespeeld
        </div>
        <div className="flex flex-col gap-3">
          <h1 className="max-w-xl text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Plan je persoonlijk adviesgesprek.
          </h1>
          <p className="max-w-2xl text-pretty text-base leading-7 text-muted-foreground">
            Je hebt het volledige Invest-traject afgerond. Kies hieronder een moment voor een persoonlijk gesprek waarin we jouw volgende stap samen scherpstellen.
          </p>
        </div>
      </header>

      <MeetingsEmbed />
    </div>
  )
}
