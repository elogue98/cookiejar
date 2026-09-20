import { requireFamilyPage } from '@/lib/serverPageAuth'

import EditRecipeClient from './EditRecipeClient'

export default async function EditRecipePage() {
  await requireFamilyPage()
  return <EditRecipeClient />
}
