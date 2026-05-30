'use client'

/**
 * Generic JSON-import panel — accepts EITHER a single ``LegalText``
 * payload OR a ``MoniteurIssue + entries`` payload, auto-detects which
 * it is, and routes to the matching endpoint.
 *
 * Detection rule (top-level keys, in order):
 *
 *   1. ``{issue, entries}``  → Moniteur shape
 *      → POST /editorial/moniteur/issues/import-json
 *   2. ``{slug, title_fr}``  → LegalText shape
 *      → POST /editorial/legal-texts
 *   3. otherwise             → ambiguous (error before submit)
 *
 * The detected shape is surfaced as a small badge above the textarea
 * so the editor sees what's about to be sent. Two placeholder
 * examples ("legal text" and "moniteur") let the editor seed the
 * textarea with a working template — both showcase the consolidated
 * ``intro_*`` + ``closing_*`` rich-text fields and the new
 * editor-managed ``sections[]`` ("partie finale") array. Idempotent
 * on both endpoints (slug for LegalText, (year, number) for Moniteur).
 *
 * Counterpart to ``backend/scripts/import_moniteur_json.py`` and the
 * ``POST /editorial/legal-texts`` create endpoint.
 */
import { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowRight,
  Braces,
  Check,
  FileJson,
  Loader2,
  Newspaper,
  RotateCcw,
  Upload,
} from 'lucide-react'

import { useT } from '@/i18n/useT'
import { apiPost } from '@/lib/api/client'
import { cn } from '@/lib/utils'
import { ErrorBanner } from '@/components/shared/ErrorBanner'
import type { MoniteurIssueRead } from '@/lib/api/endpoints'
import type { components } from '@/lib/api-types'

type LegalTextRead = components['schemas']['LegalTextRead']

// ──────────────────────────────────────────────────────────────────────
// Example payloads (legal text + moniteur). Both showcase the current
// schema: bilingual ``intro_*`` / ``closing_*`` rich-text fields
// (closing_fr supersedes the dropped signers[] + official_formula
// columns — migration 0047) and the editor-managed ``sections[]``
// "partie finale" array.
//
// ``amends_text_slug`` (optional, top-level) is an ingest-time hint
// for the article-reference linkifier: when this text is an amending
// act that modifies exactly one other law, name that law's slug here
// and "article N" refs in the body resolve to absolute
// ``/loi/{slug}?article=N`` hrefs at create time. Without it the
// linkifier falls back to same-law refs — the ``LegalChange`` graph
// rows it consults don't exist yet on first create. Omit (or set to
// null) for self-contained laws.
// ──────────────────────────────────────────────────────────────────────

const EXAMPLE_LEGAL_TEXT = `{
  "slug": "loi-portant-exemple-2026-05-21",
  "category": "loi",
  "jurisdiction": "HT",
  "title_fr": "Loi portant exemple",
  "official_title_fr": "Loi portant exemple",
  "description_fr": "Brève description du texte.",
  "issuing_date": "2026-05-21",
  "promulgation_date": "2026-05-22",
  "publication_date": "2026-05-26",
  "moniteur_ref": "N° 12",
  "official_number": "L/2026-001",
  "issuing_authority": "parlement",
  "status": "in_force",
  "editorial_status": "draft",
  "amends_text_slug": null,
  "preamble_fr": "<p>Préambule…</p>",
  "intro_fr": "<p>Vu la Constitution ;</p><p>Considérant que… ;</p><p>La Chambre des Députés et le Sénat ont voté la loi suivante :</p>",
  "intro_ht": "<p>Vu Konstitisyon an ;</p><p>Konsideran ke… ;</p><p>Chanm Depite yo ak Sena a vote lwa sa a :</p>",
  "headings": [
    {
      "key": "titre-i",
      "level": "title",
      "number": "I",
      "title_fr": "Dispositions générales"
    },
    {
      "key": "titre-i-section-1",
      "level": "section",
      "number": "1",
      "title_fr": "Champ d'application",
      "parent_key": "titre-i"
    }
  ],
  "articles": [
    {
      "number": "1",
      "slug": "art-1",
      "heading_key": "titre-i-section-1",
      "version": {
        "title_fr": "Objet",
        "text_fr": "<p>La présente loi a pour objet…</p>"
      }
    },
    {
      "number": "2",
      "slug": "art-2",
      "heading_key": "titre-i-section-1",
      "version": {
        "text_fr": "<p>Définitions…</p>"
      }
    }
  ],
  "closing_fr": "<p>Votée en sa séance du 21 mai 2026.</p><p><strong>Donné au Palais Législatif, à Port-au-Prince, le 22 mai 2026, An 223<sup>e</sup> de l'Indépendance.</strong></p><p>Jane DOE, Présidente de la République<br/>John DOE, Premier Ministre</p>",
  "closing_ht": "<p>Vote nan seyans li ki te fèt 21 me 2026 a.</p><p><strong>Bay nan Palè Lejislatif la, Pòtoprens, 22 me 2026, 223èm Ane Endepandans la.</strong></p><p>Jane DOE, Prezidan Repiblik la<br/>John DOE, Premye Minis</p>",
  "sections": [
    {
      "section_type": "resolution",
      "label_fr": "Résolution",
      "content_fr": "<p>Le Sénat de la République adopte la résolution suivante…</p>",
      "position": 0
    },
    {
      "section_type": "ratification",
      "label_fr": "Ratification",
      "content_fr": "<p>La Chambre des Députés ratifie la présente loi…</p>",
      "position": 1
    },
    {
      "section_type": "promulgation",
      "label_fr": "Acte de promulgation",
      "content_fr": "<p>Le Président de la République ordonne que la présente loi soit revêtue du sceau de la République…</p>",
      "position": 2
    },
    {
      "section_type": "approbation",
      "label_fr": "Approbation",
      "content_fr": "<p>Approuvé par le Conseil des Ministres en sa séance du 20 mai 2026.</p>",
      "position": 3
    },
    {
      "section_type": "autre",
      "label_fr": "Disposition transitoire",
      "content_fr": "<p>La présente loi entre en vigueur trente jours après sa publication au Moniteur.</p>",
      "position": 4
    }
  ]
}`

const EXAMPLE_MONITEUR = `{
  "schema_version": 1,
  "issue": {
    "number": "47",
    "year": 2014,
    "publication_date": "2014-06-04",
    "edition_label": null,
    "director": "Henry Robert MARC-CHARLES"
  },
  "entries": [
    {
      "detected_category": "loi",
      "detected_title": "Loi en attente de révision",
      "detected_number": "CL-007-09",
      "detected_date": "2014-06-04",
      "raw_text": "Article 1.- …"
    },
    {
      "detected_category": "loi",
      "detected_title": "Loi auto-promue",
      "detected_number": "CL-008-09",
      "detected_date": "2014-06-04",
      "content": {
        "slug": "loi-portant-exemple",
        "category": "loi",
        "title_fr": "Loi portant exemple",
        "promulgation_date": "2014-06-04",
        "publication_date": "2014-06-04",
        "intro_fr": "<p>Vu la Constitution ;</p><p>La Chambre des Députés et le Sénat ont voté la loi suivante :</p>",
        "intro_ht": "<p>Vu Konstitisyon an ;</p><p>Chanm Depite yo ak Sena a vote lwa sa a :</p>",
        "headings": [
          {
            "key": "titre-i",
            "level": "title",
            "number": "I",
            "title_fr": "Dispositions générales"
          }
        ],
        "articles": [
          {
            "number": "1",
            "slug": "art-1",
            "heading_key": "titre-i",
            "version": {
              "text_fr": "<p>La présente loi a pour objet…</p>"
            }
          }
        ],
        "closing_fr": "<p>Votée en sa séance du 4 juin 2014.</p><p><strong>Donné au Palais Législatif, à Port-au-Prince, le 4 juin 2014.</strong></p><p>Michel Joseph MARTELLY, Président de la République</p>",
        "closing_ht": "<p>Vote nan seyans li ki te fèt 4 jen 2014 a.</p><p><strong>Bay nan Palè Lejislatif la, Pòtoprens, 4 jen 2014.</strong></p><p>Michel Joseph MARTELLY, Prezidan Repiblik la</p>",
        "sections": [
          {
            "section_type": "promulgation",
            "label_fr": "Acte de promulgation",
            "content_fr": "<p>Le Président de la République ordonne que la présente loi soit revêtue du sceau de la République…</p>",
            "position": 0
          }
        ]
      }
    }
  ]
}`

// ──────────────────────────────────────────────────────────────────────
// Shape detection
// ──────────────────────────────────────────────────────────────────────

type Shape = 'legal_text' | 'moniteur' | 'unknown'

function detectShape(parsed: unknown): Shape {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return 'unknown'
  }
  const obj = parsed as Record<string, unknown>
  // Moniteur shape wins because its keys are more distinctive.
  if (
    obj.issue &&
    typeof obj.issue === 'object' &&
    Array.isArray(obj.entries)
  ) {
    return 'moniteur'
  }
  if (typeof obj.slug === 'string' && typeof obj.title_fr === 'string') {
    return 'legal_text'
  }
  return 'unknown'
}

/**
 * Turn an ``ApiError`` from the client into a renderable string.
 *
 * FastAPI returns 422s with ``detail`` as an ARRAY of Pydantic v2
 * validation error items (each ``{type, loc, msg, input, ctx}``).
 * Rendering that array directly into JSX explodes React with
 * "Objects are not valid as a React child". This helper:
 *
 *   - flattens the array into one ``loc.path.to.field: message`` line per error
 *   - falls back to the string ``detail`` for plain string errors (HTTPException)
 *   - falls back to the JS error message for non-HTTP failures
 */
function formatApiError(e: any): string {
  const detail = e?.body?.detail ?? e?.body
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    return detail
      .map((d: any, i: number) => {
        if (typeof d === 'string') return d
        const loc = Array.isArray(d?.loc)
          ? d.loc.filter((p: unknown) => p !== 'body').join('.')
          : ''
        const msg = d?.msg ?? d?.message ?? JSON.stringify(d)
        return loc ? `${loc}: ${msg}` : `#${i + 1}: ${msg}`
      })
      .join('\n')
  }
  if (detail && typeof detail === 'object') {
    return JSON.stringify(detail, null, 2)
  }
  return e?.message ?? String(e)
}

type Phase = 'idle' | 'submitting' | 'done'

type CreatedResult =
  | { shape: 'legal_text'; payload: LegalTextRead }
  | { shape: 'moniteur'; payload: MoniteurIssueRead }

// ──────────────────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────────────────

export default function JsonImportPanel() {
  const { language } = useT()
  const isFr = language === 'fr'

  const [jsonText, setJsonText] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<CreatedResult | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Live shape detection — runs on every keystroke. Cheap because
  // we only parse + look at a few top-level keys; the textarea is
  // capped at a few hundred KB.
  const detected: { shape: Shape; valid: boolean } = useMemo(() => {
    if (!jsonText.trim()) return { shape: 'unknown', valid: false }
    try {
      const parsed = JSON.parse(jsonText)
      return { shape: detectShape(parsed), valid: true }
    } catch {
      return { shape: 'unknown', valid: false }
    }
  }, [jsonText])

  async function handleFile(file: File) {
    try {
      const text = await file.text()
      setJsonText(text)
      JSON.parse(text)
      setError(null)
    } catch (e: any) {
      setError(
        (isFr ? 'JSON invalide : ' : 'JSON envalid : ') +
          (e?.message ?? 'parse error'),
      )
    }
  }

  async function submit() {
    setError(null)
    const raw = jsonText.trim()
    if (!raw) {
      setError(
        isFr ? 'Collez ou téléversez un JSON.' : 'Kole oswa enpòte yon JSON.',
      )
      return
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch (e: any) {
      setError(
        (isFr ? 'JSON invalide : ' : 'JSON envalid : ') +
          (e?.message ?? 'parse error'),
      )
      return
    }
    const shape = detectShape(parsed)
    if (shape === 'unknown') {
      setError(
        isFr
          ? 'Forme JSON non reconnue. Attendu : (a) {slug, title_fr, …} pour un texte légal ; (b) {issue, entries} pour un numéro du Moniteur.'
          : "Fòm JSON pa rekonèt. Atann : (a) {slug, title_fr, …} pou yon tèks legal ; (b) {issue, entries} pou yon nimewo Moniteur.",
      )
      return
    }
    setPhase('submitting')
    try {
      if (shape === 'legal_text') {
        const result = await apiPost<LegalTextRead>(
          '/editorial/legal-texts',
          parsed,
        )
        setCreated({ shape: 'legal_text', payload: result })
      } else {
        const result = await apiPost<MoniteurIssueRead>(
          '/editorial/moniteur/issues/import-json',
          parsed,
        )
        setCreated({ shape: 'moniteur', payload: result })
      }
      setPhase('done')
    } catch (e: any) {
      setError(formatApiError(e))
      setPhase('idle')
    }
  }

  function reset() {
    setJsonText('')
    setCreated(null)
    setError(null)
    setPhase('idle')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="py-2 lg:py-4 w-full">
      <div className="space-y-6">
        {/* Help block — covers BOTH shapes + the detection rule. */}
        <div className="rounded-xl border border-amber-200 bg-amber-50/40 px-5 py-4 text-sm text-amber-900">
          <p className="font-semibold mb-2 flex items-center gap-2">
            <Braces className="w-4 h-4" />
            {isFr ? 'Mode développeur — deux formes acceptées' : 'Mòd devlopè — de fòm aksepte'}
          </p>
          <ul className="leading-relaxed space-y-1.5 list-disc pl-5">
            <li>
              {isFr ? (
                <>
                  <strong>Texte légal</strong> :{' '}
                  <code className="font-mono text-xs">
                    {'{slug, category, title_fr, intro_fr/ht, headings[], articles[], closing_fr/ht, sections[]}'}
                  </code>
                  {' '}→ POST /editorial/legal-texts
                </>
              ) : (
                <>
                  <strong>Tèks legal</strong> :{' '}
                  <code className="font-mono text-xs">
                    {'{slug, category, title_fr, intro_fr/ht, headings[], articles[], closing_fr/ht, sections[]}'}
                  </code>
                  {' '}→ POST /editorial/legal-texts
                </>
              )}
            </li>
            <li>
              {isFr ? (
                <>
                  <strong>Numéro du Moniteur</strong> :{' '}
                  <code className="font-mono text-xs">
                    {'{schema_version, issue, entries[]}'}
                  </code>
                  {' '}→ POST /editorial/moniteur/issues/import-json
                </>
              ) : (
                <>
                  <strong>Nimewo Moniteur</strong> :{' '}
                  <code className="font-mono text-xs">
                    {'{schema_version, issue, entries[]}'}
                  </code>
                  {' '}→ POST /editorial/moniteur/issues/import-json
                </>
              )}
            </li>
            <li>
              {isFr
                ? 'Partie introductive : un seul champ ``intro_fr`` / ``intro_ht`` (visas + considérants + formule d’adoption réunis). Les anciennes clés (visas_fr, considerants_fr, enacting_formula_fr…) restent acceptées et sont fusionnées automatiquement dans ``intro_fr``.'
                : "Pati entwodiktif : yon sèl chan ``intro_fr`` / ``intro_ht`` (viza + konsideran + fòmil adopsyon ansanm). Ansyen kle yo (visas_fr, considerants_fr, enacting_formula_fr…) toujou aksepte epi yo rasanble otomatikman nan ``intro_fr``."}
            </li>
            <li>
              {isFr
                ? 'Partie finale : ``closing_fr`` / ``closing_ht`` (HTML — formule « Donné au Palais Législatif… » + signatures réunies) remplace l’ancien ``official_formula`` et le tableau ``signers[]`` (supprimés en migration 0047). Les anciennes clés restent acceptées et sont fusionnées automatiquement.'
                : "Pati final : ``closing_fr`` / ``closing_ht`` (HTML — fòmil « Bay nan Palè Lejislatif… » + siyati yo ansanm) ranplase ansyen ``official_formula`` ak tablo ``signers[]`` la (yo te retire nan migrasyon 0047). Ansyen kle yo toujou aksepte epi yo rasanble otomatikman."}
            </li>
            <li>
              {isFr
                ? 'Sections « partie finale » : tableau ``sections[]`` (résolution / ratification / promulgation / adoption / approbation / autre), chaque entrée porte ``section_type``, ``label_fr`` (libellé optionnel — défaut selon le type, obligatoire pour ``autre``), ``content_fr`` (HTML), ``position`` (optionnelle). HT facultatif via ``label_ht`` / ``content_ht``.'
                : "Seksyon « pati final » : tablo ``sections[]`` (rezolisyon / ratifikasyon / pwomilgasyon / adopsyon / apwobasyon / autre), chak antre gen ``section_type``, ``label_fr`` (libele opsyonèl — pa defo selon kalite a, obligatwa pou ``autre``), ``content_fr`` (HTML), ``position`` (opsyonèl). HT opsyonèl atravè ``label_ht`` / ``content_ht``."}
            </li>
            <li>
              {isFr
                ? 'Idempotent : ré-importer avec le même slug (texte légal) ou (année, numéro) (Moniteur) met à jour au lieu de dupliquer.'
                : "Idempotan : re-enpòte ak menm slug (tèks legal) oswa (ane, nimewo) (Moniteur) met ajou olye li double."}
            </li>
          </ul>
        </div>

        {/* Toolbar — placeholders + file picker */}
        <div className="flex flex-wrap items-center gap-3">
          <label
            className={cn(
              'inline-flex cursor-pointer items-center gap-2 rounded-md border border-slate-300 dark:border-slate-700',
              'bg-white px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200',
              'hover:border-primary/40 transition-colors',
              phase === 'submitting' && 'opacity-50 pointer-events-none',
            )}
          >
            <Upload className="w-4 h-4" />
            {isFr ? 'Choisir un fichier .json' : 'Chwazi yon fichye .json'}
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void handleFile(f)
              }}
            />
          </label>
          <button
            type="button"
            onClick={() => setJsonText(EXAMPLE_LEGAL_TEXT)}
            disabled={phase === 'submitting'}
            className="inline-flex items-center gap-2 rounded-md border border-dashed border-slate-300 dark:border-slate-700 bg-white px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 dark:text-slate-600 hover:border-slate-400 disabled:opacity-50"
            title={isFr ? 'Insérer un exemple de texte légal' : 'Mete yon egzanp tèks legal'}
          >
            <FileJson className="w-3.5 h-3.5" />
            {isFr ? 'Exemple — texte légal' : 'Egzanp — tèks legal'}
          </button>
          <button
            type="button"
            onClick={() => setJsonText(EXAMPLE_MONITEUR)}
            disabled={phase === 'submitting'}
            className="inline-flex items-center gap-2 rounded-md border border-dashed border-slate-300 dark:border-slate-700 bg-white px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 dark:text-slate-600 hover:border-slate-400 disabled:opacity-50"
            title={isFr ? 'Insérer un exemple de numéro du Moniteur' : 'Mete yon egzanp nimewo Moniteur'}
          >
            <FileJson className="w-3.5 h-3.5" />
            {isFr ? 'Exemple — Moniteur' : 'Egzanp — Moniteur'}
          </button>
        </div>

        {/* JSON textarea + live shape badge */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-bold uppercase tracking-widest text-primary/65">
              {isFr ? 'Payload JSON' : 'Payload JSON'}
            </label>
            <ShapeBadge detected={detected} isFr={isFr} />
          </div>
          <textarea
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            disabled={phase === 'submitting'}
            spellCheck={false}
            rows={18}
            placeholder={
              isFr
                ? 'Collez votre JSON ici. Le type (texte légal ou Moniteur) est détecté automatiquement.'
                : "Kole JSON ou la. Tip (tèks legal oswa Moniteur) detekte otomatikman."
            }
            className="w-full font-mono text-xs leading-relaxed rounded-md border border-slate-300 dark:border-slate-700 bg-white p-3 outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:opacity-50"
          />
        </div>

        {error && (
          <ErrorBanner density="compact">
            <pre className="whitespace-pre-line font-mono text-xs leading-relaxed">
              {error}
            </pre>
          </ErrorBanner>
        )}

        {/* Success card — branches on the created shape so the
            "go review" link points at the right page. */}
        {phase === 'done' && created && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 px-5 py-4">
            <p className="text-sm font-bold text-emerald-900 mb-2 flex items-center gap-2">
              <Check className="w-4 h-4" />
              {isFr ? 'Importé avec succès' : 'Enpòte avèk siksè'}
            </p>
            <p className="text-xs text-emerald-800 mb-3 leading-relaxed">
              {created.shape === 'legal_text'
                ? isFr
                  ? `Texte légal créé : ${created.payload.title_fr} (slug ${created.payload.slug}).`
                  : `Tèks legal kreye : ${created.payload.title_fr} (slug ${created.payload.slug}).`
                : isFr
                  ? `Numéro n° ${created.payload.number} / ${created.payload.year} créé (statut « parsed »).`
                  : `Nimewo n° ${created.payload.number} / ${created.payload.year} kreye (estati « parsed »).`}
            </p>
            <div className="flex flex-wrap gap-2">
              {created.shape === 'legal_text' ? (
                <Link
                  href={`/loi/${created.payload.slug}`}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary text-white px-3 py-1.5 text-xs font-semibold hover:bg-primary/90"
                >
                  {isFr ? 'Ouvrir le texte' : 'Ouvri tèks la'}
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              ) : (
                <Link
                  href={`/editorial/moniteur/${created.payload.id}/review`}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary text-white px-3 py-1.5 text-xs font-semibold hover:bg-primary/90"
                >
                  {isFr ? 'Réviser le numéro' : 'Revize nimewo a'}
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              )}
              <button
                type="button"
                onClick={reset}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-slate-400"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                {isFr ? 'Nouvel import' : 'Nouvo enpò'}
              </button>
            </div>
          </div>
        )}

        {/* Submit row */}
        {phase !== 'done' && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={submit}
              disabled={
                phase === 'submitting' ||
                !jsonText.trim() ||
                detected.shape === 'unknown'
              }
              className="inline-flex items-center gap-2 rounded-md bg-primary text-white px-5 py-2.5 text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {phase === 'submitting' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              {isFr ? 'Importer' : 'Enpòte'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function ShapeBadge({
  detected,
  isFr,
}: {
  detected: { shape: Shape; valid: boolean }
  isFr: boolean
}) {
  if (!detected.valid) {
    return null
  }
  if (detected.shape === 'legal_text') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
        <Braces className="w-3 h-3" />
        {isFr ? 'Texte légal détecté' : 'Tèks legal detekte'}
      </span>
    )
  }
  if (detected.shape === 'moniteur') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-200 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-blue-700">
        <Newspaper className="w-3 h-3" />
        {isFr ? 'Numéro du Moniteur détecté' : 'Nimewo Moniteur detekte'}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-700">
      <AlertTriangle className="w-3 h-3" />
      {isFr ? 'Forme non reconnue' : 'Fòm pa rekonèt'}
    </span>
  )
}
