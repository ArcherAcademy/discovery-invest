'use client'

import MasterclassEmbed from '@/components/MasterclassEmbed'
import { useApp } from '@/components/app-context'

export default function MasterclassPage() {
  const { refresh } = useApp()

  return <MasterclassEmbed onSubmitted={refresh} />
}
