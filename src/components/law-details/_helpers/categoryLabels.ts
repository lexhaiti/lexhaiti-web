/**
 * Bilingual labels for the ``LegalCategory`` enum.
 *
 * Every value of the backend ``LegalCategory`` enum needs an entry --
 * the hero eyebrow reads ``categoryLabels[law.category][currentLang]``
 * and a missing key would throw at render. Keep this in sync with
 * ``backend/schemas/enums.py::LegalCategory``.
 */
export const categoryLabels: Record<
  string,
  { fr: string; ht: string; color: string }
> = {
  constitution: {
    fr: 'Constitution',
    ht: 'Konstitisyon',
    color: 'bg-amber-500',
  },
  acte_fondateur: {
    fr: 'Acte fondateur',
    ht: 'Akt fondatè',
    color: 'bg-amber-400',
  },
  proclamation: {
    fr: 'Proclamation',
    ht: 'Pwoklamasyon',
    color: 'bg-orange-400',
  },
  discours: {
    fr: 'Discours',
    ht: 'Diskou',
    color: 'bg-yellow-500',
  },
  code: { fr: 'Code', ht: 'Kòd', color: 'bg-blue-500' },
  loi: { fr: 'Loi', ht: 'Lwa', color: 'bg-indigo-500' },
  loi_constitutionnelle: {
    fr: 'Loi constitutionnelle',
    ht: 'Lwa konstitisyonèl',
    color: 'bg-amber-600',
  },
  decret: { fr: 'Décret', ht: 'Dekrè', color: 'bg-green-500' },
  arrete: { fr: 'Arrêté', ht: 'Arète', color: 'bg-purple-500' },
  ordonnance: { fr: 'Ordonnance', ht: 'Òdonans', color: 'bg-teal-500' },
  circulaire: { fr: 'Circulaire', ht: 'Sikilè', color: 'bg-sky-500' },
  convention: { fr: 'Convention', ht: 'Konvansyon', color: 'bg-fuchsia-500' },
  communique: { fr: 'Communiqué', ht: 'Kominike', color: 'bg-slate-500' },
  avis: { fr: 'Avis', ht: 'Avi', color: 'bg-slate-500' },
  other_regulatory: {
    fr: 'Texte réglementaire',
    ht: 'Tèks règlemantè',
    color: 'bg-slate-500',
  },
}
