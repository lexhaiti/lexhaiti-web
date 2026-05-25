/**
 * RSC stub. Auth + fetch happens in the client component below.
 */

import EditorialJsonEditClient from './_components/EditorialJsonEditClient'

interface PageProps {
  params: Promise<{ slug: string }>
}

export default async function Page({ params }: PageProps) {
  const { slug } = await params
  return <EditorialJsonEditClient slug={slug} />
}
