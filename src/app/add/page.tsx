import { requireFamilyPage } from '@/lib/serverPageAuth'

import AddRecipeClient from './AddRecipeClient'

export default async function AddRecipePage() {
  await requireFamilyPage()
  return <AddRecipeClient />
}
