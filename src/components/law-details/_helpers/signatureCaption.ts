/**
 * Build a one-sentence intro that sits above the SIGNATAIRES list and
 * tells the visitor *what* the people below did to enact the act.
 *
 * Derived purely from the structured `signers` array — we know who
 * sat on which bureau and what date they signed, so the sentence
 * writes itself. No parsing of `official_formula` text needed.
 *
 * The exact phrasing depends on the *kind* of act:
 *   - Loi: "Adoptée par le Sénat … et par la Chambre des Députés …"
 *   - Décret / Décret-loi: "Donné le …"
 *   - Arrêté: "Fait le …"
 *   - Convention: "Signée le …"
 *
 * The promulgation date itself is metadata: it lives in the hero
 * year/date chip + the President's dated signature card. We never
 * surface it as a sentence here — that just duplicates information
 * the visitor already sees at a glance.
 *
 * Returns `null` when there's nothing useful to say (no signatories,
 * or the only ones present don't carry a `signed_at`). Callers hide
 * the caption when null so the page stays tidy.
 */

import type { components } from '@/lib/api-types'

type LegalSigner = components['schemas']['LegalSignerRead']

const MONTHS_FR = [
  '',
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
] as const

const MONTHS_HT = [
  '',
  'janvye', 'fevriye', 'mas', 'avril', 'me', 'jen',
  'jiyè', 'out', 'septanm', 'oktòb', 'novanm', 'desanm',
] as const

function fmt(iso: string | null | undefined, lang: 'fr' | 'ht'): string | null {
  if (!iso) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return iso
  const day = Number.parseInt(m[3], 10)
  const month = Number.parseInt(m[2], 10)
  const months = lang === 'ht' ? MONTHS_HT : MONTHS_FR
  return `${day} ${months[month] ?? ''} ${m[1]}`
}

export function buildSignatureLeadCaption(
  signers: LegalSigner[] | undefined,
  category: string | null | undefined,
  lang: 'fr' | 'ht',
  // Optional ISO date for the LegalText's ``promulgation_date``.
  // When the authoring signer's signed_at MATCHES this date, the
  // ``Donné le …`` / ``Fait le …`` caption is redundant with the
  // hero's ``Année / Promulguée`` chip + the dated signature grid
  // — suppress it to avoid the same date appearing three times.
  // Pass ``null`` / ``undefined`` to keep the legacy behaviour
  // (always render the caption when there's a date).
  promulgationIso?: string | null,
  // Optional ISO date for the LegalText's ``issuing_date`` ("Fait
  // à …, le …" / parliamentary adoption). Same redundancy logic as
  // ``promulgationIso``: if the authoring signer's date matches,
  // the caption duplicates what the issuing-date metadata + the
  // dated signature card already say. Critical for constitutions
  // (no promulgation_date, but issuing_date carries the adoption).
  issuingIso?: string | null,
): string | null {
  if (!signers || signers.length === 0) return null

  const senateBureau = signers.filter((s) => s.chamber === 'senat')
  const chamberBureau = signers.filter((s) => s.chamber === 'chambre')
  const author = signers.find((s) => s.signing_capacity === 'authoring')

  const senateDate = fmt(senateBureau[0]?.signed_at, lang)
  const chamberDate = fmt(chamberBureau[0]?.signed_at, lang)
  const authorDate = fmt(author?.signed_at, lang)
  // Truthy when the authoring signer's date matches the hero's
  // promulgation OR issuing date — used by the single-signer
  // branches below to suppress an otherwise-redundant
  // ``Donné / Fait / Signé le X`` line.
  const authorSignedSlice = author?.signed_at?.slice(0, 10)
  const authorRedundant =
    authorSignedSlice != null &&
    ((promulgationIso != null &&
      authorSignedSlice === promulgationIso.slice(0, 10)) ||
      (issuingIso != null && authorSignedSlice === issuingIso.slice(0, 10)))

  // ---- Loi-style: bicameral adoption ----
  // We DON'T append "Promulguée le X" here — the promulgation date is
  // already shown in the hero metadata and on the President's dated
  // signature card. The Sénat / Chambre dates are kept because those
  // are vote dates the hero doesn't expose.
  if (senateBureau.length > 0 && chamberBureau.length > 0) {
    const fr = (() => {
      let s = 'Adoptée par le Sénat de la République'
      if (senateDate) s += ` le ${senateDate}`
      s += ' et par la Chambre des Députés'
      if (chamberDate) s += ` le ${chamberDate}`
      s += '.'
      return s
    })()
    const ht = (() => {
      let s = 'Adopte pa Sena Repiblik la'
      if (senateDate) s += ` le ${senateDate}`
      s += ' ak pa Chanm Depite yo'
      if (chamberDate) s += ` le ${chamberDate}`
      s += '.'
      return s
    })()
    return lang === 'ht' ? ht : fr
  }

  // ---- Décret / Décret-loi: head-of-state authoring ("Donné le …") ----
  // ``le décret`` is masculine in French — the past participle agrees
  // (``Donné``, not ``Donnée`` — the earlier code had it as feminine,
  // which was a grammar bug).
  if (author && (category === 'decret' || category === 'decret-loi')) {
    if (authorDate && !authorRedundant) {
      return lang === 'ht'
        ? `Bay le ${authorDate}.`
        : `Donné le ${authorDate}.`
    }
  }

  // ---- Arrêté: minister authoring ("Fait le …") ----
  // ``l'arrêté`` is masculine — ``Fait``, not ``Faite``.
  if (author && category === 'arrete') {
    if (authorDate && !authorRedundant) {
      return lang === 'ht'
        ? `Fèt le ${authorDate}.`
        : `Fait le ${authorDate}.`
    }
  }

  // ---- Convention / traité ----
  // ``la convention`` is feminine — ``Signée`` is correct.
  if (author && category === 'convention') {
    if (authorDate && !authorRedundant) {
      return lang === 'ht'
        ? `Siyen le ${authorDate}.`
        : `Signée le ${authorDate}.`
    }
  }

  // No standalone ``Signé le X.`` caption for unknown / historical
  // categories (constitution / proclamation / discours / acte_fondateur).
  // The signing date is metadata: it lives in the dated signature
  // card below + the new ``issuing_date`` field surfaced in
  // MetadataEditor. Repeating it as a sentence above the signers is
  // visual noise — same reasoning that already retires the
  // ``Promulguée le X.`` caption.

  return null
}
