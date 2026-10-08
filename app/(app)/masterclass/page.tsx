'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import MasterclassDecisionContent from '@/components/MasterclassDecisionContent'
import MasterclassSignupPanel from '@/components/MasterclassSignupPanel'
import { useApp } from '@/components/app-context'

export default function MasterclassPage() {
  const router = useRouter()
  const { investAvondGeclaimd, refresh } = useApp()
  const [selectedEdition, setSelectedEdition] = useState<string | null>(null)

  const sharedProps = {
    alreadySubmitted: investAvondGeclaimd,
    onSubmitted: refresh,
    onViewBonus: () => router.push('/traject#bonusmateriaal'),
    selectedEdition,
    onSelectEdition: setSelectedEdition,
  }

  return (
    <MasterclassDecisionContent
      primarySignup={<MasterclassSignupPanel {...sharedProps} instanceId="primary" compact />}
      closingSignup={<MasterclassSignupPanel {...sharedProps} instanceId="closing" />}
    />
  )
}
