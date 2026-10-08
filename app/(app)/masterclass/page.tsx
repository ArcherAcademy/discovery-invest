'use client'

import { useRouter } from 'next/navigation'
import InvestAvondUnlockModal from '@/components/InvestAvondUnlockModal'
import MasterclassDecisionContent from '@/components/MasterclassDecisionContent'
import { useApp } from '@/components/app-context'

export default function MasterclassPage() {
  const router = useRouter()
  const { investAvondGeclaimd, refresh } = useApp()

  return (
    <MasterclassDecisionContent>
      <InvestAvondUnlockModal
        open
        displayMode="page"
        alreadySubmitted={investAvondGeclaimd}
        onSubmitted={refresh}
        onViewBonus={() => router.push('/traject#bonusmateriaal')}
      />
    </MasterclassDecisionContent>
  )
}
