import Image from 'next/image'
import { redirect } from 'next/navigation'

interface ActiverenPageProps {
  searchParams: Promise<{ token?: string; error?: string }>
}

export default async function ActiverenPage({ searchParams }: ActiverenPageProps) {
  const { token, error } = await searchParams

  if (token && !error) {
    redirect(`/api/activeren/activate?token=${encodeURIComponent(token)}`)
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <video
        src="/hero-intro.mp4"
        autoPlay
        muted
        loop
        playsInline
        className="absolute inset-0 size-full object-cover"
      />
      <div className="absolute inset-0 bg-background/80" />
      <section className="relative flex w-full max-w-sm flex-col items-center gap-6 rounded-2xl border border-border bg-card/90 p-6 text-center shadow-2xl backdrop-blur-xl">
        <Image src="/archer-logo.png" alt="Archer" width={96} height={24} className="h-6 w-auto brightness-0 invert" priority />
        <div className="flex flex-col gap-2">
          <h1 className="text-balance text-xl font-bold text-card-foreground">Activatielink ongeldig</h1>
          <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
            {error ?? 'Er staat geen activatietoken in deze link.'}
          </p>
        </div>
        <a href="mailto:info@archerinvest.nl" className="text-sm font-semibold text-primary underline underline-offset-4">
          Neem contact op
        </a>
      </section>
    </main>
  )
}
