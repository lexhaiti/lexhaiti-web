'use client'

/**
 * Right-side sheet for editing every structured field of a court
 * decision — identification, parties, judges, procedural history,
 * moyens, dispositif, full text, summary + headnotes. Mirrors the
 * MetadataEditor pattern for legal texts (right-aligned sheet with a
 * scrollable column + sticky save bar) but covers the rich nested
 * shape of a DecisionDetail.
 *
 * The local form state is the in-memory editor draft — when the user
 * hits Save we serialize it into a ``DecisionCreatePayload``-compatible
 * patch and PATCH the backend. The full-replace shape lets the editor
 * delete / reorder rows without having to track per-row diffs.
 */

import { useEffect, useState, useTransition } from 'react'
import { Loader2, Plus, Save, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useToast } from '@/components/ui/toast-simple'
import { useT } from '@/i18n/useT'
import { ApiError } from '@/lib/api/client'
import {
  type CourtType,
  type DecisionDetail,
  type DecisionMoyenInput,
  type DecisionOutcome,
  type DecisionPartyInput,
  type DecisionPatch,
  type DecisionProceduralStepInput,
  type DecisionJudgeInput,
  type EditorialJudgeRole,
  type EditorialPartyRole,
  updateDecision,
} from '@/lib/api/endpoints'
import { cn } from '@/lib/utils'

// -----------------------------------------------------------------------
// Static option lists — kept inline because they map 1:1 to backend
// enums and adding new values is a coordinated change anyway.
// -----------------------------------------------------------------------

const COURT_VALUES: CourtType[] = [
  'cassation',
  'appel',
  'tpi',
  'tribunal_commerce',
  'tribunal_enfants',
  'autre',
]

const OUTCOME_VALUES = [
  'rejet',
  'cassation',
  'cassation_partielle',
  'confirmation',
  'infirmation',
  'irrecevabilite',
  'desistement',
  'autre',
] as const satisfies readonly DecisionOutcome[]

const PARTY_ROLES: EditorialPartyRole[] = [
  'pourvoyante',
  'intimee',
  'demandeur',
  'defendeur',
  'appelant',
  'intime',
  'partie_civile',
  'consort',
]

const JUDGE_ROLES: EditorialJudgeRole[] = [
  'president',
  'vice_president',
  'juge',
  'rapporteur',
  'substitut',
  'greffier',
]

const MOYEN_OUTCOMES: ('accepted' | 'rejected' | 'partial')[] = [
  'accepted',
  'rejected',
  'partial',
]

// Same slug regex the backend uses (services/editorial/service.py:_SLUG_RE).
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,198}[a-z0-9])?$/

// -----------------------------------------------------------------------
// Form state shape — every nested row carries a stable client-side
// ``_key`` so React can keep keyed reconciliation stable while the
// editor reorders / removes rows. The backend ignores it.
// -----------------------------------------------------------------------

type RowKey = { _key: string }

type FormParty = RowKey & {
  role: string
  name: string
  party_type: 'person' | 'company'
  representative_name: string
  lawyers: Array<RowKey & { name: string; barreau: string }>
}

type FormJudge = RowKey & {
  name: string
  role: string
  order: string // string so the <input type=number> empty state round-trips cleanly
}

type FormProc = RowKey & {
  court: string
  decision_date: string
  case_number: string
  outcome: string
}

type FormMoyen = RowKey & {
  number: string
  title: string
  body_fr: string
  body_ht: string
  court_response_fr: string
  court_response_ht: string
  outcome: string
}

type FormState = {
  slug: string
  court: CourtType
  chamber: string
  formation: string
  case_number: string
  decision_date: string
  hearing_date: string
  outcome: string
  parties_anonymized: boolean
  subject_matter: string[]
  parties: FormParty[]
  judges: FormJudge[]
  procedural_history: FormProc[]
  moyens: FormMoyen[]
  dispositif_fr: string
  dispositif_ht: string
  full_text_fr: string
  full_text_ht: string
  summary_fr: string
  summary_ht: string
  headnotes_fr: string
  headnotes_ht: string
  comment: string
}

function newKey(): string {
  // Browser-only crypto.randomUUID exists since Safari 15 / Chrome 92.
  // The fallback Math.random keeps the editor working in SSR-rendered
  // initial state (we render the sheet client-only via `'use client'`,
  // so the fallback is only used for jsdom in tests).
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }
  return `k${Math.random().toString(36).slice(2)}${Date.now()}`
}

function emptyParty(): FormParty {
  return {
    _key: newKey(),
    role: 'pourvoyante',
    name: '',
    party_type: 'person',
    representative_name: '',
    lawyers: [],
  }
}

function emptyJudge(): FormJudge {
  return { _key: newKey(), name: '', role: 'juge', order: '' }
}

function emptyProc(): FormProc {
  return {
    _key: newKey(),
    court: '',
    decision_date: '',
    case_number: '',
    outcome: '',
  }
}

function emptyMoyen(nextNumber: number): FormMoyen {
  return {
    _key: newKey(),
    number: String(nextNumber),
    title: '',
    body_fr: '',
    body_ht: '',
    court_response_fr: '',
    court_response_ht: '',
    outcome: '',
  }
}

function emptyLawyer(): RowKey & { name: string; barreau: string } {
  return { _key: newKey(), name: '', barreau: '' }
}

// Seed the form from a DecisionDetail. Falls back to empty strings for
// nullable fields so the controlled <input>s never flip uncontrolled.
function seed(decision: DecisionDetail): FormState {
  return {
    slug: decision.slug,
    court: decision.court,
    chamber: decision.chamber ?? '',
    formation: decision.formation ?? '',
    case_number: decision.case_number ?? '',
    decision_date: decision.decision_date,
    hearing_date: (decision as { hearing_date?: string | null }).hearing_date ?? '',
    outcome: decision.outcome ?? '',
    parties_anonymized: decision.parties_anonymized ?? true,
    subject_matter:
      decision.subject_tags?.map((s) => s.key).filter(Boolean) ?? [],
    parties:
      decision.parties?.map((p) => {
        // The public `DecisionParty` carries `counsel` as free-text; the
        // editorial shape uses a nested lawyers list. We try a "Name (Bar)"
        // single-row split as a best-effort migration; otherwise an empty
        // list.
        const lawyers: FormParty['lawyers'] = []
        if (p.counsel) {
          const match = /^([^(]+?)\s*(?:\(([^)]+)\))?\s*$/.exec(p.counsel)
          if (match) {
            lawyers.push({
              _key: newKey(),
              name: (match[1] ?? '').trim(),
              barreau: (match[2] ?? '').trim(),
            })
          }
        }
        return {
          _key: newKey(),
          role: p.role,
          name: p.name,
          party_type: 'person' as const,
          representative_name: p.qualifier ?? '',
          lawyers,
        }
      }) ?? [],
    judges:
      decision.judges?.map((j, i) => ({
        _key: newKey(),
        name: j.name,
        role: j.role,
        order: String(i + 1),
      })) ?? [],
    procedural_history:
      decision.procedural_history?.map((s) => ({
        _key: newKey(),
        court: String(s.court ?? ''),
        decision_date: s.date,
        case_number: s.case_number ?? '',
        outcome: s.outcome ?? '',
      })) ?? [],
    moyens:
      decision.moyens?.map((m) => ({
        _key: newKey(),
        number: String(m.number),
        title: m.title_fr ?? '',
        body_fr: m.argument_fr ?? '',
        body_ht: m.argument_ht ?? '',
        court_response_fr: m.response_fr ?? '',
        court_response_ht: m.response_ht ?? '',
        outcome: m.outcome ?? '',
      })) ?? [],
    dispositif_fr: decision.dispositif_fr ?? '',
    dispositif_ht: decision.dispositif_ht ?? '',
    full_text_fr: decision.full_text_fr ?? '',
    full_text_ht: decision.full_text_ht ?? '',
    summary_fr: decision.summary_fr ?? '',
    summary_ht: decision.summary_ht ?? '',
    headnotes_fr: decision.headnotes_fr ?? '',
    headnotes_ht: decision.headnotes_ht ?? '',
    comment: '',
  }
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  decision: DecisionDetail
  onSaved?: (updated: DecisionDetail) => void
  onSlugChanged?: (newSlug: string) => void
}

export function DecisionEditor({
  open,
  onOpenChange,
  decision,
  onSaved,
  onSlugChanged,
}: Props) {
  const { t } = useT()
  const { toast } = useToast()
  const [pending, startTransition] = useTransition()
  const [form, setForm] = useState<FormState>(() => seed(decision))

  // Reset form whenever the sheet (re)opens so stale drafts don't leak
  // across openings.
  useEffect(() => {
    if (open) setForm(seed(decision))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, decision.slug, decision.updated_at])

  function patch<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function save() {
    const trimmedSlug = form.slug.trim()
    if (!trimmedSlug) {
      toast(t('decisionEditor.sheet.slugEmpty'))
      return
    }
    if (!SLUG_RE.test(trimmedSlug)) {
      toast(t('decisionEditor.sheet.slugInvalid'))
      return
    }
    if (!form.decision_date) {
      toast(t('decisionEditor.sheet.decisionDateEmpty'))
      return
    }

    // Build the patch. We send every field — the backend no-ops
    // unchanged keys but the nested arrays (parties / judges / moyens
    // / procedural_history) must be the full desired state because the
    // editor allows reordering + deletion.
    const body: DecisionPatch = {
      slug: trimmedSlug,
      court: form.court,
      chamber: form.chamber.trim() || null,
      formation: form.formation.trim() || null,
      case_number: form.case_number.trim() || null,
      decision_date: form.decision_date,
      hearing_date: form.hearing_date.trim() || null,
      outcome: (form.outcome.trim() as DecisionOutcome) || null,
      parties_anonymized: form.parties_anonymized,
      subject_matter: form.subject_matter
        .map((s) => s.trim())
        .filter(Boolean),
      parties: form.parties
        .filter((p) => p.name.trim() || p.role.trim())
        .map<DecisionPartyInput>((p) => ({
          role: p.role,
          name: p.name.trim(),
          party_type: p.party_type,
          representative_name:
            p.party_type === 'company' && p.representative_name.trim()
              ? p.representative_name.trim()
              : null,
          lawyers: p.lawyers
            .filter((l) => l.name.trim())
            .map((l) => ({
              name: l.name.trim(),
              barreau: l.barreau.trim() || null,
            })),
        })),
      judges: form.judges
        .filter((j) => j.name.trim())
        .map<DecisionJudgeInput>((j) => ({
          name: j.name.trim(),
          role: j.role,
          order: j.order ? Number(j.order) : null,
        })),
      procedural_history: form.procedural_history
        .filter((s) => s.court.trim() && s.decision_date)
        .map<DecisionProceduralStepInput>((s) => ({
          court: s.court.trim(),
          decision_date: s.decision_date,
          case_number: s.case_number.trim() || null,
          outcome: s.outcome.trim() || null,
        })),
      moyens: form.moyens
        .filter((m) => m.number.trim() || m.title.trim() || m.body_fr.trim())
        .map<DecisionMoyenInput>((m) => ({
          number: Number(m.number) || 0,
          title: m.title.trim() || null,
          body_fr: m.body_fr.trim() || null,
          body_ht: m.body_ht.trim() || null,
          court_response_fr: m.court_response_fr.trim() || null,
          court_response_ht: m.court_response_ht.trim() || null,
          outcome: m.outcome.trim() || null,
        })),
      dispositif_fr: form.dispositif_fr.trim() || null,
      dispositif_ht: form.dispositif_ht.trim() || null,
      full_text_fr: form.full_text_fr.trim() || null,
      full_text_ht: form.full_text_ht.trim() || null,
      summary_fr: form.summary_fr.trim() || null,
      summary_ht: form.summary_ht.trim() || null,
      headnotes_fr: form.headnotes_fr.trim() || null,
      headnotes_ht: form.headnotes_ht.trim() || null,
    }
    if (form.comment.trim()) body.comment = form.comment.trim()

    startTransition(async () => {
      try {
        const updated = await updateDecision(decision.slug, body)
        toast(t('decisionEditor.sheet.saved'))
        onOpenChange(false)
        const newSlug = updated.slug
        if (newSlug && newSlug !== decision.slug) {
          onSlugChanged?.(newSlug)
        } else {
          onSaved?.(updated)
        }
      } catch (err) {
        const code = err instanceof ApiError ? ` (${err.status})` : ''
        toast(`${t('decisionEditor.sheet.failed')}${code}`)
      }
    })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl lg:max-w-3xl overflow-y-auto p-0"
      >
        <SheetHeader className="px-6 sm:px-8 pt-8 pb-2">
          <SheetTitle>{t('decisionEditor.sheet.title')}</SheetTitle>
          <SheetDescription>
            {t('decisionEditor.sheet.desc')}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-2 space-y-10 px-6 sm:px-8 pb-40">
          {/* A. Identification */}
          <SectionBlock
            title={t('decisionEditor.sheet.sections.identification')}
          >
            <Field
              label={t('decisionEditor.sheet.fields.slug')}
              hint={t('decisionEditor.sheet.fields.slugHint')}
            >
              <Input
                value={form.slug}
                onChange={(e) => patch('slug', e.target.value)}
                className="font-mono text-sm"
                spellCheck={false}
              />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label={t('decisionEditor.sheet.fields.court')}>
                <Select
                  value={form.court}
                  onValueChange={(v) =>
                    patch('court', v as CourtType)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COURT_VALUES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {t(`jurisprudence.courts.${c}`, { fallback: c })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label={t('decisionEditor.sheet.fields.outcome')}>
                <Select
                  value={form.outcome || '__none'}
                  onValueChange={(v) =>
                    patch('outcome', v === '__none' ? '' : v)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">—</SelectItem>
                    {OUTCOME_VALUES.map((o) => (
                      <SelectItem key={o} value={o}>
                        {t(`decisionEditor.sheet.outcomes.${o}`, {
                          fallback: o,
                        })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label={t('decisionEditor.sheet.fields.chamber')}>
                <Input
                  value={form.chamber}
                  onChange={(e) => patch('chamber', e.target.value)}
                />
              </Field>
              <Field label={t('decisionEditor.sheet.fields.formation')}>
                <Input
                  value={form.formation}
                  onChange={(e) => patch('formation', e.target.value)}
                />
              </Field>
            </div>

            <Field label={t('decisionEditor.sheet.fields.caseNumber')}>
              <Input
                value={form.case_number}
                onChange={(e) => patch('case_number', e.target.value)}
              />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label={t('decisionEditor.sheet.fields.decisionDate')}>
                <Input
                  type="date"
                  value={form.decision_date}
                  onChange={(e) => patch('decision_date', e.target.value)}
                  required
                />
              </Field>
              <Field label={t('decisionEditor.sheet.fields.hearingDate')}>
                <Input
                  type="date"
                  value={form.hearing_date}
                  onChange={(e) => patch('hearing_date', e.target.value)}
                />
              </Field>
            </div>

            <Field
              label={t('decisionEditor.sheet.fields.subjectMatter')}
              hint={t('decisionEditor.sheet.fields.subjectMatterHint')}
            >
              <ChipInput
                value={form.subject_matter}
                onChange={(next) => patch('subject_matter', next)}
              />
            </Field>

            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.parties_anonymized}
                onChange={(e) =>
                  patch('parties_anonymized', e.target.checked)
                }
                className="rounded border-slate-300"
              />
              {t('decisionEditor.sheet.fields.partiesAnonymized')}
            </label>
          </SectionBlock>

          {/* B. Parties */}
          <SectionBlock title={t('decisionEditor.sheet.sections.parties')}>
            <RepeatingList
              rows={form.parties}
              onAdd={() =>
                patch('parties', [...form.parties, emptyParty()])
              }
              onRemove={(idx) =>
                patch(
                  'parties',
                  form.parties.filter((_, i) => i !== idx),
                )
              }
              addLabel={t('decisionEditor.sheet.fields.addParty')}
              renderRow={(party, idx) => (
                <PartyRow
                  party={party}
                  onChange={(next) =>
                    patch(
                      'parties',
                      form.parties.map((p, i) => (i === idx ? next : p)),
                    )
                  }
                />
              )}
            />
          </SectionBlock>

          {/* C. Judges */}
          <SectionBlock title={t('decisionEditor.sheet.sections.judges')}>
            <RepeatingList
              rows={form.judges}
              onAdd={() => patch('judges', [...form.judges, emptyJudge()])}
              onRemove={(idx) =>
                patch(
                  'judges',
                  form.judges.filter((_, i) => i !== idx),
                )
              }
              addLabel={t('decisionEditor.sheet.fields.addJudge')}
              renderRow={(judge, idx) => (
                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-12 sm:col-span-6">
                    <Input
                      placeholder={t('decisionEditor.sheet.fields.judgeName')}
                      value={judge.name}
                      onChange={(e) =>
                        patch(
                          'judges',
                          form.judges.map((j, i) =>
                            i === idx ? { ...j, name: e.target.value } : j,
                          ),
                        )
                      }
                    />
                  </div>
                  <div className="col-span-8 sm:col-span-4">
                    <Select
                      value={judge.role}
                      onValueChange={(v) =>
                        patch(
                          'judges',
                          form.judges.map((j, i) =>
                            i === idx ? { ...j, role: v } : j,
                          ),
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {JUDGE_ROLES.map((r) => (
                          <SelectItem key={r} value={r}>
                            {t(`decisionEditor.sheet.judgeRoles.${r}`, {
                              fallback: r,
                            })}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-4 sm:col-span-2">
                    <Input
                      type="number"
                      placeholder={t('decisionEditor.sheet.fields.judgeOrder')}
                      value={judge.order}
                      onChange={(e) =>
                        patch(
                          'judges',
                          form.judges.map((j, i) =>
                            i === idx
                              ? { ...j, order: e.target.value }
                              : j,
                          ),
                        )
                      }
                    />
                  </div>
                </div>
              )}
            />
          </SectionBlock>

          {/* D. Procedural history */}
          <SectionBlock title={t('decisionEditor.sheet.sections.procedure')}>
            <RepeatingList
              rows={form.procedural_history}
              onAdd={() =>
                patch('procedural_history', [
                  ...form.procedural_history,
                  emptyProc(),
                ])
              }
              onRemove={(idx) =>
                patch(
                  'procedural_history',
                  form.procedural_history.filter((_, i) => i !== idx),
                )
              }
              addLabel={t('decisionEditor.sheet.fields.addProc')}
              renderRow={(step, idx) => (
                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-12 sm:col-span-5">
                    <Input
                      placeholder={t(
                        'decisionEditor.sheet.fields.procCourt',
                      )}
                      value={step.court}
                      onChange={(e) =>
                        patch(
                          'procedural_history',
                          form.procedural_history.map((s, i) =>
                            i === idx
                              ? { ...s, court: e.target.value }
                              : s,
                          ),
                        )
                      }
                    />
                  </div>
                  <div className="col-span-6 sm:col-span-3">
                    <Input
                      type="date"
                      value={step.decision_date}
                      onChange={(e) =>
                        patch(
                          'procedural_history',
                          form.procedural_history.map((s, i) =>
                            i === idx
                              ? { ...s, decision_date: e.target.value }
                              : s,
                          ),
                        )
                      }
                    />
                  </div>
                  <div className="col-span-6 sm:col-span-2">
                    <Input
                      placeholder={t(
                        'decisionEditor.sheet.fields.procCaseNumber',
                      )}
                      value={step.case_number}
                      onChange={(e) =>
                        patch(
                          'procedural_history',
                          form.procedural_history.map((s, i) =>
                            i === idx
                              ? { ...s, case_number: e.target.value }
                              : s,
                          ),
                        )
                      }
                    />
                  </div>
                  <div className="col-span-12 sm:col-span-2">
                    <Input
                      placeholder={t(
                        'decisionEditor.sheet.fields.procOutcome',
                      )}
                      value={step.outcome}
                      onChange={(e) =>
                        patch(
                          'procedural_history',
                          form.procedural_history.map((s, i) =>
                            i === idx
                              ? { ...s, outcome: e.target.value }
                              : s,
                          ),
                        )
                      }
                    />
                  </div>
                </div>
              )}
            />
          </SectionBlock>

          {/* E. Moyens */}
          <SectionBlock title={t('decisionEditor.sheet.sections.moyens')}>
            <RepeatingList
              rows={form.moyens}
              onAdd={() =>
                patch('moyens', [
                  ...form.moyens,
                  emptyMoyen(form.moyens.length + 1),
                ])
              }
              onRemove={(idx) =>
                patch(
                  'moyens',
                  form.moyens.filter((_, i) => i !== idx),
                )
              }
              addLabel={t('decisionEditor.sheet.fields.addMoyen')}
              renderRow={(moyen, idx) => (
                <div className="space-y-2">
                  <div className="grid grid-cols-12 gap-2">
                    <div className="col-span-3 sm:col-span-2">
                      <Input
                        type="number"
                        placeholder={t(
                          'decisionEditor.sheet.fields.moyenNumber',
                        )}
                        value={moyen.number}
                        onChange={(e) =>
                          patch(
                            'moyens',
                            form.moyens.map((m, i) =>
                              i === idx
                                ? { ...m, number: e.target.value }
                                : m,
                            ),
                          )
                        }
                      />
                    </div>
                    <div className="col-span-9 sm:col-span-7">
                      <Input
                        placeholder={t(
                          'decisionEditor.sheet.fields.moyenTitle',
                        )}
                        value={moyen.title}
                        onChange={(e) =>
                          patch(
                            'moyens',
                            form.moyens.map((m, i) =>
                              i === idx
                                ? { ...m, title: e.target.value }
                                : m,
                            ),
                          )
                        }
                      />
                    </div>
                    <div className="col-span-12 sm:col-span-3">
                      <Select
                        value={moyen.outcome || '__none'}
                        onValueChange={(v) =>
                          patch(
                            'moyens',
                            form.moyens.map((m, i) =>
                              i === idx
                                ? {
                                    ...m,
                                    outcome: v === '__none' ? '' : v,
                                  }
                                : m,
                            ),
                          )
                        }
                      >
                        <SelectTrigger>
                          <SelectValue
                            placeholder={t(
                              'decisionEditor.sheet.fields.moyenOutcome',
                            )}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none">—</SelectItem>
                          {MOYEN_OUTCOMES.map((o) => (
                            <SelectItem key={o} value={o}>
                              {t(
                                `decisionEditor.sheet.moyenOutcomes.${o}`,
                                { fallback: o },
                              )}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Textarea
                      rows={4}
                      placeholder={t(
                        'decisionEditor.sheet.fields.moyenBodyFr',
                      )}
                      value={moyen.body_fr}
                      onChange={(e) =>
                        patch(
                          'moyens',
                          form.moyens.map((m, i) =>
                            i === idx
                              ? { ...m, body_fr: e.target.value }
                              : m,
                          ),
                        )
                      }
                    />
                    <Textarea
                      rows={4}
                      placeholder={t(
                        'decisionEditor.sheet.fields.moyenBodyHt',
                      )}
                      value={moyen.body_ht}
                      onChange={(e) =>
                        patch(
                          'moyens',
                          form.moyens.map((m, i) =>
                            i === idx
                              ? { ...m, body_ht: e.target.value }
                              : m,
                          ),
                        )
                      }
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Textarea
                      rows={4}
                      placeholder={t(
                        'decisionEditor.sheet.fields.moyenResponseFr',
                      )}
                      value={moyen.court_response_fr}
                      onChange={(e) =>
                        patch(
                          'moyens',
                          form.moyens.map((m, i) =>
                            i === idx
                              ? {
                                  ...m,
                                  court_response_fr: e.target.value,
                                }
                              : m,
                          ),
                        )
                      }
                    />
                    <Textarea
                      rows={4}
                      placeholder={t(
                        'decisionEditor.sheet.fields.moyenResponseHt',
                      )}
                      value={moyen.court_response_ht}
                      onChange={(e) =>
                        patch(
                          'moyens',
                          form.moyens.map((m, i) =>
                            i === idx
                              ? {
                                  ...m,
                                  court_response_ht: e.target.value,
                                }
                              : m,
                          ),
                        )
                      }
                    />
                  </div>
                </div>
              )}
            />
          </SectionBlock>

          {/* F. Dispositif */}
          <SectionBlock title={t('decisionEditor.sheet.sections.dispositif')}>
            <Field label={t('decisionEditor.sheet.fields.dispositifFr')}>
              <Textarea
                rows={6}
                value={form.dispositif_fr}
                onChange={(e) => patch('dispositif_fr', e.target.value)}
              />
            </Field>
            <Field label={t('decisionEditor.sheet.fields.dispositifHt')}>
              <Textarea
                rows={4}
                value={form.dispositif_ht}
                onChange={(e) => patch('dispositif_ht', e.target.value)}
              />
            </Field>
          </SectionBlock>

          {/* G. Full text */}
          <SectionBlock title={t('decisionEditor.sheet.sections.fullText')}>
            <Field label={t('decisionEditor.sheet.fields.fullTextFr')}>
              <Textarea
                rows={12}
                value={form.full_text_fr}
                onChange={(e) => patch('full_text_fr', e.target.value)}
                className="font-serif text-sm"
              />
            </Field>
            <Field label={t('decisionEditor.sheet.fields.fullTextHt')}>
              <Textarea
                rows={6}
                value={form.full_text_ht}
                onChange={(e) => patch('full_text_ht', e.target.value)}
                className="font-serif text-sm"
              />
            </Field>
          </SectionBlock>

          {/* H. Summary + headnotes */}
          <SectionBlock title={t('decisionEditor.sheet.sections.summary')}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label={t('decisionEditor.sheet.fields.summaryFr')}>
                <Textarea
                  rows={4}
                  value={form.summary_fr}
                  onChange={(e) => patch('summary_fr', e.target.value)}
                />
              </Field>
              <Field label={t('decisionEditor.sheet.fields.summaryHt')}>
                <Textarea
                  rows={4}
                  value={form.summary_ht}
                  onChange={(e) => patch('summary_ht', e.target.value)}
                />
              </Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label={t('decisionEditor.sheet.fields.headnotesFr')}>
                <Textarea
                  rows={4}
                  value={form.headnotes_fr}
                  onChange={(e) => patch('headnotes_fr', e.target.value)}
                />
              </Field>
              <Field label={t('decisionEditor.sheet.fields.headnotesHt')}>
                <Textarea
                  rows={4}
                  value={form.headnotes_ht}
                  onChange={(e) => patch('headnotes_ht', e.target.value)}
                />
              </Field>
            </div>
          </SectionBlock>

          {/* I. Audit comment */}
          <Field label={t('decisionEditor.sheet.fields.comment')}>
            <Textarea
              rows={2}
              value={form.comment}
              onChange={(e) => patch('comment', e.target.value)}
            />
          </Field>
        </div>

        <div className="fixed bottom-0 right-0 w-full sm:max-w-2xl lg:max-w-3xl border-t bg-white px-6 sm:px-8 py-4 flex justify-end gap-2 z-10">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            {t('decisionEditor.sheet.cancel')}
          </Button>
          <Button onClick={save} disabled={pending}>
            {pending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {pending
              ? t('decisionEditor.sheet.saving')
              : t('decisionEditor.sheet.save')}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// -----------------------------------------------------------------------
// Small building blocks
// -----------------------------------------------------------------------

function SectionBlock({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-4">
      <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 border-b border-slate-200 pb-2">
        {title}
      </h3>
      <div className="space-y-4">{children}</div>
    </section>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
        {label}
      </span>
      {children}
      {hint && (
        <span className="mt-1 block text-[11px] leading-relaxed text-slate-500">
          {hint}
        </span>
      )}
    </label>
  )
}

function RepeatingList<T extends RowKey>({
  rows,
  onAdd,
  onRemove,
  renderRow,
  addLabel,
}: {
  rows: T[]
  onAdd: () => void
  onRemove: (idx: number) => void
  renderRow: (row: T, idx: number) => React.ReactNode
  addLabel: string
}) {
  const { t } = useT()
  return (
    <div className="space-y-3">
      {rows.map((row, idx) => (
        <div
          key={row._key}
          className="relative rounded-lg border border-slate-200 bg-slate-50/40 p-3 sm:p-4"
        >
          <button
            type="button"
            onClick={() => onRemove(idx)}
            className="absolute top-2 right-2 p-1 text-slate-400 hover:text-red-600 rounded-md hover:bg-red-50"
            aria-label={t('decisionEditor.sheet.removeRow')}
            title={t('decisionEditor.sheet.removeRow')}
          >
            <X className="w-4 h-4" />
          </button>
          <div className="pr-6">{renderRow(row, idx)}</div>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onAdd}
        className="text-xs"
      >
        <Plus className="w-3.5 h-3.5 mr-1.5" />
        {addLabel}
      </Button>
    </div>
  )
}

function PartyRow({
  party,
  onChange,
}: {
  party: FormParty
  onChange: (next: FormParty) => void
}) {
  const { t } = useT()
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-12 gap-2">
        <div className="col-span-12 sm:col-span-4">
          <Select
            value={party.role}
            onValueChange={(v) => onChange({ ...party, role: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PARTY_ROLES.map((r) => (
                <SelectItem key={r} value={r}>
                  {t(`decisionEditor.sheet.partyRoles.${r}`, { fallback: r })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-12 sm:col-span-5">
          <Input
            placeholder={t('decisionEditor.sheet.fields.partyName')}
            value={party.name}
            onChange={(e) => onChange({ ...party, name: e.target.value })}
          />
        </div>
        <div className="col-span-12 sm:col-span-3">
          <Select
            value={party.party_type}
            onValueChange={(v) =>
              onChange({ ...party, party_type: v as 'person' | 'company' })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="person">
                {t('decisionEditor.sheet.fields.partyTypePerson')}
              </SelectItem>
              <SelectItem value="company">
                {t('decisionEditor.sheet.fields.partyTypeCompany')}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {party.party_type === 'company' && (
        <Input
          placeholder={t('decisionEditor.sheet.fields.representativeName')}
          value={party.representative_name}
          onChange={(e) =>
            onChange({ ...party, representative_name: e.target.value })
          }
        />
      )}

      <div className="space-y-2 rounded-md border border-slate-200 bg-white p-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
          {t('decisionEditor.sheet.fields.lawyers')}
        </p>
        {party.lawyers.map((lawyer, lidx) => (
          <div key={lawyer._key} className="grid grid-cols-12 gap-2">
            <div className="col-span-7">
              <Input
                placeholder={t('decisionEditor.sheet.fields.lawyerName')}
                value={lawyer.name}
                onChange={(e) =>
                  onChange({
                    ...party,
                    lawyers: party.lawyers.map((l, i) =>
                      i === lidx ? { ...l, name: e.target.value } : l,
                    ),
                  })
                }
              />
            </div>
            <div className="col-span-4">
              <Input
                placeholder={t('decisionEditor.sheet.fields.lawyerBarreau')}
                value={lawyer.barreau}
                onChange={(e) =>
                  onChange({
                    ...party,
                    lawyers: party.lawyers.map((l, i) =>
                      i === lidx ? { ...l, barreau: e.target.value } : l,
                    ),
                  })
                }
              />
            </div>
            <button
              type="button"
              onClick={() =>
                onChange({
                  ...party,
                  lawyers: party.lawyers.filter((_, i) => i !== lidx),
                })
              }
              className="col-span-1 flex items-center justify-center text-slate-400 hover:text-red-600"
              aria-label={t('decisionEditor.sheet.removeRow')}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            onChange({ ...party, lawyers: [...party.lawyers, emptyLawyer()] })
          }
          className="text-xs"
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          {t('decisionEditor.sheet.fields.addLawyer')}
        </Button>
      </div>
    </div>
  )
}

/** Tag-input — type, hit Enter / comma, chip lands. Backspace on an
 *  empty input deletes the last chip. */
function ChipInput({
  value,
  onChange,
}: {
  value: string[]
  onChange: (next: string[]) => void
}) {
  const [draft, setDraft] = useState('')

  function commit(raw: string) {
    const v = raw.trim()
    if (!v) return
    if (value.includes(v)) return
    onChange([...value, v])
    setDraft('')
  }

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2 py-1.5 min-h-[36px]',
        'focus-within:border-gray-400 focus-within:ring-gray-400/20 focus-within:ring-[3px]',
      )}
    >
      {value.map((tag, idx) => (
        <span
          key={`${tag}-${idx}`}
          className="inline-flex items-center gap-1 rounded-full bg-slate-100 text-slate-700 text-xs px-2 py-0.5"
        >
          {tag}
          <button
            type="button"
            onClick={() => onChange(value.filter((_, i) => i !== idx))}
            className="text-slate-400 hover:text-red-600"
            aria-label="Remove tag"
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault()
            commit(draft)
          } else if (e.key === 'Backspace' && !draft && value.length > 0) {
            onChange(value.slice(0, -1))
          }
        }}
        onBlur={() => commit(draft)}
        className="flex-1 min-w-[120px] text-sm bg-transparent outline-none placeholder:text-slate-400"
      />
    </div>
  )
}
