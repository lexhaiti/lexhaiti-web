/**
 * Editorial-mode detail for a court decision. Server stub — auth check
 * happens client-side via useEditorMode (same pattern the editorial
 * dashboard uses) so we can render the public DecisionDetailClient as
 * a child and overlay the EditorBar. Falls back to the editorial-only
 * read endpoint so drafts are visible.
 */

import EditorialDecisionDetailClient from './_components/EditorialDecisionDetailClient'

interface PageProps {
  params: Promise<{ slug: string }>
}

export default async function Page({ params }: PageProps) {
  const { slug } = await params
  return <EditorialDecisionDetailClient slug={slug} />
}
