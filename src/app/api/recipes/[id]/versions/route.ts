import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabaseClient'
import type { Json } from '@/types/json'

type VersionUser = {
  id: string
  name: string | null
  avatar_url: string | null
}

type VersionRow = {
  id: string
  recipe_id: string
  user_id: string
  timestamp: string
  field_changed: string
  previous_value: Json | string | null
  new_value: Json | string | null
  description: string | null
  users: VersionUser | VersionUser[] | null
}

/**
 * GET /api/recipes/[id]/versions
 * 
 * Fetches all version history for a recipe, sorted newest first
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const supabase = createServerClient()

    // Fetch versions with user information
    const { data: versions, error } = await supabase
      .from('recipe_versions')
      .select(`
        id,
        recipe_id,
        user_id,
        timestamp,
        field_changed,
        previous_value,
        new_value,
        description,
        users:user_id (
          id,
          name,
          avatar_url
        )
      `)
      .eq('recipe_id', id)
      .order('timestamp', { ascending: false })

    if (error) {
      console.error('Error fetching versions:', error)
      // If table doesn't exist, return empty array
      if (error.code === '42P01' || error.message.includes('does not exist')) {
        return NextResponse.json({ success: true, data: [] })
      }
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    // Transform the data to flatten user info and parse JSON values
    const versionRows: VersionRow[] = Array.isArray(versions) ? versions as VersionRow[] : []
    const transformedVersions = versionRows.map((version) => {
      let previousValue = null
      let newValue = null

      try {
        if (version.previous_value) {
          previousValue = typeof version.previous_value === 'string' 
            ? JSON.parse(version.previous_value) 
            : version.previous_value
        }
      } catch {
        previousValue = version.previous_value
      }

      try {
        if (version.new_value) {
          newValue = typeof version.new_value === 'string' 
            ? JSON.parse(version.new_value) 
            : version.new_value
        }
      } catch {
        newValue = version.new_value
      }

      const relatedUser = Array.isArray(version.users) ? version.users[0] : version.users

      return {
        id: version.id,
        recipe_id: version.recipe_id,
        user_id: version.user_id,
        timestamp: version.timestamp,
        field_changed: version.field_changed,
        previous_value: previousValue,
        new_value: newValue,
        description: version.description,
        user: relatedUser
          ? {
              id: relatedUser.id,
              name: relatedUser.name,
              avatar_url: relatedUser.avatar_url,
            }
          : null,
      }
    })

    return NextResponse.json({ success: true, data: transformedVersions })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
