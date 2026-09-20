import { requireFamilyPage } from '@/lib/serverPageAuth'

import MealJarContent from '@/app/components/MealJar/MealJarContent'

export default async function MealsPage() {
  await requireFamilyPage()
  return <MealJarContent />
}
