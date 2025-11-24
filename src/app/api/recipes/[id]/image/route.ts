import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabaseClient'
import { uploadOptimizedImage } from '@/lib/imageOptimization'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { success: false, error: 'File must be an image' },
        { status: 400 }
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const supabase = createServerClient()

    // Upload optimized image
    // We pass the recipe ID and the original extension
    const extension = file.name.split('.').pop() || 'jpg'
    const publicUrl = await uploadOptimizedImage(supabase, buffer, id, extension)

    if (!publicUrl) {
      return NextResponse.json(
        { success: false, error: 'Failed to upload image' },
        { status: 500 }
      )
    }

    // Update recipe with new image URL
    const { error: updateError } = await supabase
      .from('recipes')
      .update({ image_url: publicUrl })
      .eq('id', id)

    if (updateError) {
      console.error('Error updating recipe image_url:', updateError)
      return NextResponse.json(
        { success: false, error: 'Failed to update recipe record' },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      success: true, 
      imageUrl: publicUrl 
    })

  } catch (error) {
    console.error('Error in recipe image upload:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

