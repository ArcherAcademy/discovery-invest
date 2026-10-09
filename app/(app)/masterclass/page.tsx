'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import MasterclassDecisionContent from '@/components/MasterclassDecisionContent'
import MasterclassSignupPanel from '@/components/MasterclassSignupPanel'
import { useApp } from '@/components/app-context'

export default function MasterclassPage() {
  const router = useRouter()
  const { investAvondGeclaimd, refresh } = useApp()
  const [selectedEdition, setSelectedEdition] = useState<string | null>(null)

  const viewBonus = () => router.push('/home')
  const signupProps = {
    alreadySubmitted: investAvondGeclaimd,
    onSubmitted: refresh,
    onViewBonus: viewBonus,
    selectedEdition,
    onSelectEdition: setSelectedEdition,
  }

  return (
    <MasterclassDecisionContent
      primarySignup={<MasterclassSignupPanel {...signupProps} instanceId="primary" compact />}
      closingSignup={<MasterclassSignupPanel {...signupProps} instanceId="closing" />}
    />
  )
}
