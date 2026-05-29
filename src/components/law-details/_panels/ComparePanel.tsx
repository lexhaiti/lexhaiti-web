/**
 * Side-by-side compare panel — word-level diff between two versions of
 * a single article. Receives the full version list with body text from
 * the parent ArticleViewer and computes the diff locally so editors can
 * see deletions and additions inline.
 *
 * Diff algorithm: classic LCS over word tokens, then a single backward
 * walk to produce the edit script. HTML tags are stripped before
 * tokenization so the diff reflects content changes only, not markup
 * differences from Tiptap's serializer.
 */
'use client'

import React, { useMemo, useState } from 'react'
import { ArrowLeftRight } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ArticleVersionRead } from '@/lib/api/endpoints'
import { diffHtml, type DiffOp } from '@/lib/diff/word-diff'

interface ComparePanelProps {
  /** Full version rows including body text. Newest-first ordering is
   *  preserved from the parent; the diff doesn't care about order. */
  versions: ArticleVersionRead[]
  currentLang: 'fr' | 'ht'
}

/**
 * Render a single side of the diff. ``side`` controls which op gets
 * styled: the left column highlights deletions (what existed in the
 * older version but not the newer), the right column highlights
 * insertions. The other side's marker is skipped so each column reads
 * as a clean version of that text.
 */
function renderSide(ops: DiffOp[], side: 'old' | 'new') {
  const nodes: React.ReactNode[] = []
  let key = 0
  for (const op of ops) {
    if (op.op === 'equal') {
      nodes.push(<span key={key++}>{op.text}</span>)
      continue
    }
    if (side === 'old' && op.op === 'delete') {
      nodes.push(
        <span
          key={key++}
          className="bg-red-100/70 dark:bg-red-500/20 line-through decoration-red-400 px-0.5 rounded-sm"
        >
          {op.text}
        </span>,
      )
      continue
    }
    if (side === 'new' && op.op === 'insert') {
      nodes.push(
        <span
          key={key++}
          className="bg-emerald-100/70 dark:bg-emerald-500/20 px-0.5 rounded-sm"
        >
          {op.text}
        </span>,
      )
    }
    // delete on the 'new' side and insert on the 'old' side are intentionally omitted
  }
  return nodes
}

export function ComparePanel({ versions, currentLang }: ComparePanelProps) {
  // Default selection: compare the previous version (versions[1]) against
  // the latest (versions[0]). Parent passes them newest-first.
  const [fromId, setFromId] = useState<number>(
    versions[1]?.id ?? versions[0].id,
  )
  const [toId, setToId] = useState<number>(versions[0].id)

  const versionsById = useMemo(() => {
    const map = new Map<number, ArticleVersionRead>()
    for (const v of versions) map.set(v.id, v)
    return map
  }, [versions])

  const fromVersion = versionsById.get(fromId)
  const toVersion = versionsById.get(toId)

  const ops = useMemo(() => {
    if (!fromVersion || !toVersion) return []
    return diffHtml(fromVersion.text_fr, toVersion.text_fr)
  }, [fromVersion, toVersion])

  const isSameVersion = fromId === toId

  return (
    <div className="pt-6">
      <p className="text-xs text-slate-500 mb-4">
        {currentLang === 'fr'
          ? 'Sélectionnez deux versions pour comparer.'
          : 'Chwazi de vèsyon pou konpare.'}
      </p>
      <div className="flex items-center gap-3 flex-wrap mb-5">
        <Select value={String(fromId)} onValueChange={(v) => setFromId(Number(v))}>
          <SelectTrigger className="w-44 h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {versions.map((v) => (
              <SelectItem key={v.id} value={String(v.id)}>
                v{v.version_number}
                {v.effective_from ? ` — ${v.effective_from}` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <button
          type="button"
          onClick={() => {
            const tmp = fromId
            setFromId(toId)
            setToId(tmp)
          }}
          aria-label={
            currentLang === 'fr'
              ? 'Inverser les versions'
              : 'Echanje vèsyon yo'
          }
          className="text-slate-400 hover:text-slate-700 flex-shrink-0"
        >
          <ArrowLeftRight className="w-4 h-4" />
        </button>
        <Select value={String(toId)} onValueChange={(v) => setToId(Number(v))}>
          <SelectTrigger className="w-44 h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {versions.map((v) => (
              <SelectItem key={v.id} value={String(v.id)}>
                v{v.version_number}
                {v.effective_from ? ` — ${v.effective_from}` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isSameVersion ? (
        <p className="text-xs italic text-slate-400">
          {currentLang === 'fr'
            ? 'Choisissez deux versions différentes pour afficher les différences.'
            : 'Chwazi de vèsyon diferan pou wè diferans yo.'}
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-gray-200 dark:border-slate-700 p-4 bg-white dark:bg-slate-900">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">
              v{fromVersion?.version_number}
              {fromVersion?.effective_from
                ? ` — ${fromVersion.effective_from}`
                : ''}
            </div>
            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
              {renderSide(ops, 'old')}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 dark:border-slate-700 p-4 bg-white dark:bg-slate-900">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">
              v{toVersion?.version_number}
              {toVersion?.effective_from
                ? ` — ${toVersion.effective_from}`
                : ''}
            </div>
            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
              {renderSide(ops, 'new')}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
