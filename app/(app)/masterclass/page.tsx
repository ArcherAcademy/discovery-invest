'use client'

import { useRouter } from 'next/navigation'
import InvestAvondUnlockModal from '@/components/InvestAvondUnlockModal'
import { useApp } from '@/components/app-context'

export default function MasterclassPage() {
  const router = useRouter()
  const { investAvondGeclaimd, refresh } = useApp()

  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12" aria-labelledby="masterclass-page-title">
      <h1 id="masterclass-page-title" className="sr-only">
        Kies je Invest Masterclass-editie
      </h1>
      <InvestAvondUnlockModal
        open
        displayMode="page"
        alreadySubmitted={investAvondGeclaimd}
        onSubmitted={refresh}
        onViewBonus={() => router.push('/traject#bonusmateriaal')}
      />
    </section>
  )
}
