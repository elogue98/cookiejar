import { requireFamilyPage } from '@/lib/serverPageAuth'

import PlacesClient from './PlacesClient'

export default async function PlacesPage() {
  await requireFamilyPage()
  return <PlacesClient />
}
