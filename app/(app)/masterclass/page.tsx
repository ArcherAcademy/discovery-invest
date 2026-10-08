'use client'

import { useRouter } from 'next/navigation'
import MasterclassDecisionContent from '@/components/MasterclassDecisionContent'
import MasterclassSignupPanel from '@/components/MasterclassSignupPanel'
import { useApp } from '@/components/app-context'

export default function MasterclassPage() {
  const router = useRouter()
  const { investAvondGeclaimd, refresh } = useApp()

  return (
    <MasterclassDecisionContent
      signup={
        <MasterclassSignupPanel
          alreadySubmitted={investAvondGeclaimd}
          onSubmitted={refresh}
          onViewBonus={() => router.push('/traject#bonusmateriaal')}
        />
      }
    />
  )
}
