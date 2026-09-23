export default function MasterclassPage() {
  return (
    <section className="absolute inset-0 overflow-hidden bg-background" aria-labelledby="masterclass-page-title">
      <h1 id="masterclass-page-title" className="sr-only">
        Schrijf je in
      </h1>
      <iframe
        src="https://archerinvest.be/wachtlijst"
        title="Schrijf je in voor de Archer Invest masterclass"
        className="block h-[calc(100%+1082px)] w-full -translate-y-[104px] border-0 bg-background md:h-[calc(100%+721px)]"
        allow="payment"
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </section>
  )
}
