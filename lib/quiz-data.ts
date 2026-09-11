export type QuizOption = 'A' | 'B' | 'C' | 'D'

export interface QuizQuestion {
  no: number
  vraag: string
  opties: Record<QuizOption, string>
  juist: QuizOption
}

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    no: 1,
    vraag: 'Waarmee vergeleek de premier de financiële situatie van België?',
    opties: {
      A: 'Met Griekenland in 2008',
      B: 'Met Italië',
      C: 'Met de crisis van 1929',
      D: 'Met Nederland',
    },
    juist: 'A',
  },
  {
    no: 2,
    vraag: 'Hoeveel bedraagt de Belgische staatsschuld?',
    opties: {
      A: '312 miljard',
      B: '726 miljard',
      C: '1,2 biljoen',
      D: '480 miljard',
    },
    juist: 'B',
  },
  {
    no: 3,
    vraag: 'Wat was de gemiddelde inflatie in België de afgelopen vijf jaar?',
    opties: {
      A: '2,1%',
      B: '3,3%',
      C: '4,7%',
      D: '6,0%',
    },
    juist: 'C',
  },
  {
    no: 4,
    vraag: 'Welk percentage van de Belgen bouwt effectief vermogen op via beleggen?',
    opties: {
      A: '37%',
      B: '20%',
      C: '10%',
      D: '1%',
    },
    juist: 'D',
  },
  {
    no: 5,
    vraag: 'Hoe heet de fase van ongeveer 25 tot 60 jaar in de levensloopgrafiek?',
    opties: {
      A: 'De investerende fase',
      B: 'De creërende fase',
      C: 'De consoliderende fase',
      D: 'De rustfase',
    },
    juist: 'B',
  },
  {
    no: 6,
    vraag: 'Wat ging er mis bij de grootouders uit het verhaal?',
    opties: {
      A: 'Te veel uitgegeven aan vakanties',
      B: 'Huis te goedkoop verkocht',
      C: 'Nooit de shift naar investeren gemaakt',
      D: 'Geen pensioen opgebouwd',
    },
    juist: 'C',
  },
  {
    no: 7,
    vraag: 'Waar staat GGR voor?',
    opties: {
      A: 'Gegarandeerd Groeirendement',
      B: 'Gewogen Gemiddeld Rendement',
      C: 'Globaal Groei Ratio',
      D: 'Gecombineerd Geïnvesteerd Rendement',
    },
    juist: 'B',
  },
  {
    no: 8,
    vraag: 'Waarom gebruik je nettorendement bij je GGR?',
    opties: {
      A: 'Omdat je de inflatie eraf moet rekenen',
      B: 'Omdat de bank dat verplicht',
      C: 'Omdat brutorendement niet bestaat',
      D: 'Omdat je anders belasting betaalt',
    },
    juist: 'A',
  },
  {
    no: 9,
    vraag: 'Welk rendement levert het huis waarin je zelf woont meestal op in je GGR (95% van de bevolking)?',
    opties: {
      A: '5%',
      B: '2%',
      C: '0%',
      D: '8%',
    },
    juist: 'C',
  },
  {
    no: 10,
    vraag: 'Wat is de TER van een ETF?',
    opties: {
      A: 'Totaal rendement per jaar',
      B: 'Belasting op dividenden',
      C: 'Percentage beheerskosten per jaar',
      D: 'De minimale inleg',
    },
    juist: 'C',
  },
  {
    no: 11,
    vraag: 'Welk type ETF verdient in België meestal de voorkeur en waarom?',
    opties: {
      A: 'Distribuerend, jaarlijkse dividenden',
      B: 'Accumulerend, dividenden automatisch herbelegd zonder directe roerende voorheffing',
      C: 'Distribuerend, fiscaal voordeliger',
      D: 'Geen verschil',
    },
    juist: 'B',
  },
  {
    no: 12,
    vraag: 'Waarom zijn veel grote ETF\'s in Ierland geregistreerd?',
    opties: {
      A: 'Het is verplicht',
      B: 'Lagere bronbelasting op dividenden',
      C: 'Hogere rendementen',
      D: 'Nul kosten',
    },
    juist: 'B',
  },
  {
    no: 13,
    vraag: 'Hoe heet de portefeuillestructuur die Archer gebruikt?',
    opties: {
      A: 'Klein, middel, groot',
      B: 'Kern, satelliet, speculatief',
      C: 'Basis, groei, risico',
      D: 'Veilig, neutraal, agressief',
    },
    juist: 'B',
  },
  {
    no: 14,
    vraag: 'Welke methode vermijdt het probleem van instappen op een all-time high?',
    opties: {
      A: 'Wachten tot de markt daalt',
      B: 'Alles in één keer investeren',
      C: 'De DCA-methode, gespreid instappen',
      D: 'Enkel obligaties',
    },
    juist: 'C',
  },
]
