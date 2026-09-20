import { requireFamilyPage } from '@/lib/serverPageAuth'

import PlacesImportClient from './PlacesImportClient'

export default async function PlacesImportPage() {
  await requireFamilyPage()
  return <PlacesImportClient />
}
