import { requireFamilyPage } from '@/lib/serverPageAuth'

import ProfileClient from './ProfileClient'

export default async function ProfilePage() {
  await requireFamilyPage()
  return <ProfileClient />
}
