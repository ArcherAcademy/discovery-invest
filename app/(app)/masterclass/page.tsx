export default function MasterclassPage() {
  return (
    <section className="absolute inset-0 overflow-hidden bg-background" aria-labelledby="masterclass-page-title">
      <h1 id="masterclass-page-title" className="sr-only">
        Masterclass wachtlijst
      </h1>
      <iframe
        src="https://archerinvest.be/wachtlijst"
        title="Masterclass wachtlijst van Archer Invest"
        className="block h-[calc(100%+978px)] w-full -translate-y-24 border-0 bg-background md:h-[calc(100%+617px)]"
        allow="payment"
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </section>
  )
}
