export default function KennismakingseventPage() {
  return (
    <section className="absolute inset-0 overflow-hidden bg-background" aria-labelledby="event-page-title">
      <h1 id="event-page-title" className="sr-only">
        Kennismakingsevent
      </h1>
      <iframe
        src="https://workshops.archerinvest.be"
        title="Kennismakingsevent van Archer Invest"
        className="block size-full border-0 bg-background"
        allow="payment"
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </section>
  )
}
