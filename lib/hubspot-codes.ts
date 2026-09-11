/**
 * Centrale mapping van interne workflow-naam naar exacte HubSpot mail-code.
 * Dit is de ENIGE plek waar deze mapping staat. Importeer vanuit hier.
 * Het veld "workflow" in de POST naar HubSpot moet exact een van deze codes zijn.
 *
 * De HubSpot-codes mail_1 t/m mail_19 liggen vast aan HubSpot-kant en zijn
 * daar geverifieerd. De codes zijn LEIDEND: de app volgt HubSpot, niet andersom.
 * Er zijn 18 interne triggers voor 19 codes — mail_13_workshop_laatste_dag
 * bestaat wel in HubSpot maar heeft (nog) geen interne trigger, dus die branch
 * wordt door de app nooit aangeroepen. Er is GEEN gat in de nummering: alle
 * video-herinneringen lopen aaneengesloten van mail_5 t/m mail_9, ook al is er
 * geen herinnering voor video 1 (video 2 is de eerste die herinnerd wordt).
 *
 *   mail_1  welkom               → direct bij activatie (fireInstant)
 *   mail_2  activatie_2u         → klok: 2u na created_at, activated_at nog null
 *   mail_3  activatie_24u        → klok: 24u na created_at, activated_at nog null
 *   mail_4  activatie_72u        → klok: 72u na created_at, activated_at nog null
 *   mail_5  video_2_herinnering  → klok: inactief 24u, video 2 is eerstvolgende
 *   mail_6  video_3_herinnering  → klok: inactief 24u, video 3 is eerstvolgende
 *   mail_7  video_4_herinnering  → klok: inactief 24u, video 4 is eerstvolgende
 *   mail_8  video_5_herinnering  → klok: inactief 24u, video 5 is eerstvolgende
 *   mail_9  video_6_herinnering  → klok: inactief 24u, video 6 is eerstvolgende
 *   mail_10 dag4_inactief        → klok: 4d na all_completed_at, niet geboekt
 *   mail_11 alles_gezien_c1      → instant: alle 6 kernvideo's voltooid
 *   mail_12 workshop_48u         → klok: 7d voor event starts_at, geboekt
 *                                  LET OP: de HubSpot-branch heet 48u, de app
 *                                  vuurt op 7 dagen. Naam en timing lopen uiteen;
 *                                  dit is bewust zo gelaten, niet stilzwijgend.
 *   mail_13 (geen interne trigger — workshop_laatste_dag, alleen in HubSpot)
 *   mail_14 workshop_bevestiging → instant: event_booked net true gezet
 *   mail_15 trial_verlopen       → klok: na trial_expires_at, niet geboekt
 *   mail_16 verloopt_5d          → klok: ≤5d voor trial_expires_at
 *   mail_17 verloopt_3d          → klok: ≤3d voor trial_expires_at
 *   mail_18 verloopt_1d          → klok: ≤1d voor trial_expires_at
 *   mail_19 verloopt_6u          → klok: ≤6u voor trial_expires_at
 *
 * Mail_1 welkom wordt ALLEEN door de app gestuurd (activeren/activate → fireInstant).
 * account-aanmaken stuurt GEEN mail — dat endpoint maakt enkel account + invite aan.
 * Er is dus geen dubbele welkomstmail.
 */
export const HUBSPOT_CODE: Record<string, string> = {
  welkom:               'mail_1_welkom',
  activatie_2u:         'mail_2_activatie_2u',
  activatie_24u:        'mail_3_activatie_24u',
  activatie_72u:        'mail_4_activatie_72u',
  video_2_herinnering:  'mail_5_video2',
  video_3_herinnering:  'mail_6_video3',
  video_4_herinnering:  'mail_7_video4',
  video_5_herinnering:  'mail_8_video5',
  video_6_herinnering:  'mail_9_video6',
  alles_gezien_c1:      'mail_11_alles_gezien',
  dag4_inactief:        'mail_10_dag4',
  workshop_1w_voor:     'mail_12_workshop_48u',
  workshop_bevestiging: 'mail_14_workshop_bevestiging',
  trial_verlopen:       'mail_15_trial_verlopen',
  verloopt_5d:          'mail_16_verloopt_5d',
  verloopt_3d:          'mail_17_verloopt_3d',
  verloopt_1d:          'mail_18_verloopt_1d',
  verloopt_6u:          'mail_19_verloopt_6u',
}

/**
 * De 18 door de app aanroepbare HubSpot mail-codes, op codevolgorde.
 * mail_13_workshop_laatste_dag ontbreekt bewust: die branch bestaat in HubSpot
 * maar heeft geen interne trigger en kan dus niet vanuit de app gevuurd worden.
 */
export const HUBSPOT_CODES_ORDERED: { code: string; label: string; intern: string }[] = [
  { code: 'mail_1_welkom',              intern: 'welkom',               label: 'Mail 1 · Welkom na activatie' },
  { code: 'mail_2_activatie_2u',        intern: 'activatie_2u',         label: 'Mail 2 · Niet geactiveerd na 2u' },
  { code: 'mail_3_activatie_24u',       intern: 'activatie_24u',        label: 'Mail 3 · Niet geactiveerd na 24u' },
  { code: 'mail_4_activatie_72u',       intern: 'activatie_72u',        label: 'Mail 4 · Niet geactiveerd na 72u' },
  { code: 'mail_5_video2',              intern: 'video_2_herinnering',  label: 'Mail 5 · Herinnering video 2' },
  { code: 'mail_6_video3',              intern: 'video_3_herinnering',  label: 'Mail 6 · Herinnering video 3' },
  { code: 'mail_7_video4',              intern: 'video_4_herinnering',  label: 'Mail 7 · Herinnering video 4' },
  { code: 'mail_8_video5',              intern: 'video_5_herinnering',  label: 'Mail 8 · Herinnering video 5' },
  { code: 'mail_9_video6',              intern: 'video_6_herinnering',  label: 'Mail 9 · Herinnering video 6' },
  { code: 'mail_10_dag4',               intern: 'dag4_inactief',        label: 'Mail 10 · Dag 4 inactief na voltooiing' },
  { code: 'mail_11_alles_gezien',       intern: 'alles_gezien_c1',      label: 'Mail 11 · Alle 6 video\'s gezien' },
  { code: 'mail_12_workshop_48u',       intern: 'workshop_1w_voor',     label: 'Mail 12 · Voor workshop (app vuurt op 7d)' },
  { code: 'mail_14_workshop_bevestiging', intern: 'workshop_bevestiging', label: 'Mail 14 · Workshop boeking bevestigd' },
  { code: 'mail_15_trial_verlopen',     intern: 'trial_verlopen',       label: 'Mail 15 · Trial verlopen' },
  { code: 'mail_16_verloopt_5d',        intern: 'verloopt_5d',          label: 'Mail 16 · Trial verloopt over 5 dagen' },
  { code: 'mail_17_verloopt_3d',        intern: 'verloopt_3d',          label: 'Mail 17 · Trial verloopt over 3 dagen' },
  { code: 'mail_18_verloopt_1d',        intern: 'verloopt_1d',          label: 'Mail 18 · Trial verloopt over 1 dag' },
  { code: 'mail_19_verloopt_6u',        intern: 'verloopt_6u',          label: 'Mail 19 · Trial verloopt over 6 uur' },
]
