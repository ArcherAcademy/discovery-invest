'use client'

import { useRouter } from 'next/navigation'
import MasterclassDecisionContent from '@/components/MasterclassDecisionContent'
import MasterclassSignupPanel from '@/components/MasterclassSignupPanel'
import { useApp } from '@/components/app-context'

export default function MasterclassPage() {
  const router = useRouter()
  const { investAvondGeclaimd, refresh } = useApp()
  const onViewBonus = () => router.push('/traject#bonusmateriaal')

  return (
    <MasterclassDecisionContent
      primarySignup={
        <MasterclassSignupPanel
          instanceId="hero"
          compact
          alreadySubmitted={investAvondGeclaimd}
          onSubmitted={refresh}
          onViewBonus={onViewBonus}
        />
      }
      closingSignup={
        <MasterclassSignupPanel
          instanceId="closing"
          alreadySubmitted={investAvondGeclaimd}
          onSubmitted={refresh}
          onViewBonus={onViewBonus}
        />
      }
    />
  )
}
