'use server'

import { aiComplete } from './ai'
import { mapPlaceTypesToTags } from './googlePlaces'

type PlaceTagInput = {
  name: string
  address?: string | null
  types?: string[] | null
}

const KEYWORD_TAGS = [
  'coffee',
  'cafe',
  'espresso',
  'bakery',
  'brunch',
  'breakfast',
  'dessert',
  'pizza',
  'burger',
  'sandwich',
  'taco',
  'ramen',
  'sushi',
  'noodle',
  'bbq',
  'steak',
  'seafood',
  'curry',
  'kebab',
  'shawarma',
  'dimsum',
  'dumpling',
  'poke',
  'vegan',
  'vegetarian',
  'gluten-free',
  'halal',
  'kosher',
  'thai',
  'indian',
  'mexican',
  'chinese',
  'japanese',
  'korean',
  'vietnamese',
  'mediterranean',
  'greek',
  'italian',
  'french',
  'spanish',
  'tapas',
  'lebanese',
  'turkish',
  'middle eastern',
  'american',
  'pub',
  'bar',
  'cocktails',
  'wine',
  'beer',
  'brewery',
  'speakeasy',
]

function keywordFallback(input: PlaceTagInput): string[] {
  const text = `${input.name ?? ''} ${input.address ?? ''} ${(input.types ?? []).join(' ')}`.toLowerCase()
  const matches = KEYWORD_TAGS.filter((tag) => text.includes(tag))
  const typeTags = mapPlaceTypesToTags(input.types)
  return Array.from(new Set([...typeTags, ...matches]))
    .filter(Boolean)
    .slice(0, 8)
}

const isRecord = (val: unknown): val is Record<string, unknown> => typeof val === 'object' && val !== null

export async function generateTagsForPlace(input: PlaceTagInput): Promise<string[]> {
  const name = input.name?.trim()
  if (!name) return []

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    console.warn('OPENAI_API_KEY not set, using keyword fallback for place tags')
    return keywordFallback(input)
  }

  try {
    const prompt = `You are a place tagging assistant for food & drink spots.
Generate 5-10 short, lowercase tags (1-2 words) that accurately describe the cuisine, specific food items, and vibe.
Prioritize specific food items (e.g. "burgers", "tacos", "croissants") over generic types (e.g. "food", "point of interest", "establishment").
If the name suggests a specific food (e.g. "Junk Marylebone" -> burgers/comfort food, "Sandwich Sandwich" -> sandwiches), prioritize that.
Return JSON: {"tags": ["burgers", "comfort food", ...]} with no extra text.

Name: ${input.name}
Address: ${input.address ?? 'n/a'}
Types: ${(input.types ?? []).join(', ') || 'n/a'}`.trim()

    const response = await aiComplete(
      [
        {
          role: 'system',
          content:
            'You are a helpful tagging assistant. Always return JSON with a "tags" array. Only include concise, lowercase tags (1-2 words).',
        },
        { role: 'user', content: prompt },
      ],
      { temperature: 0.2, max_tokens: 120, response_format: { type: 'json_object' } }
    )

    let parsed: unknown
    try {
      parsed = JSON.parse(response || '{}')
    } catch {
      console.warn('Failed to parse AI place tags response, falling back to keywords')
      return keywordFallback(input)
    }

    let tags: unknown[] = []
    if (Array.isArray(parsed)) {
      tags = parsed
    } else if (isRecord(parsed) && Array.isArray(parsed.tags)) {
      tags = parsed.tags
    }

    const cleaned = tags
      .map((t) => (typeof t === 'string' ? t : null))
      .filter((t): t is string => Boolean(t))
      .map((t) => t.toLowerCase().trim().replace(/\s+/g, ' '))
      .filter((t) => t && t.length <= 30 && t.split(/\s+/).length <= 2)

    if (!cleaned.length) {
      return keywordFallback(input)
    }

    const merged = Array.from(new Set([...cleaned, ...mapPlaceTypesToTags(input.types)]))
      .filter((t) => !['point of interest', 'establishment', 'food', 'store'].includes(t))
    return merged.slice(0, 10)
  } catch (err) {
    console.error('Error generating place tags, using fallback', err)
    return keywordFallback(input)
  }
}

