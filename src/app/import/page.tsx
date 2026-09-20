import { requireFamilyPage } from '@/lib/serverPageAuth'

import ImportRecipeClient from './ImportRecipeClient'

export default async function ImportPage() {
  await requireFamilyPage()
  return <ImportRecipeClient />
}
