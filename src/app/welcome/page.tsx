import { requireFamilyPage } from '@/lib/serverPageAuth'
import WelcomeLanding from '@/app/components/WelcomeLanding'

export default async function WelcomePage() {
  await requireFamilyPage()
  return <WelcomeLanding />
}
