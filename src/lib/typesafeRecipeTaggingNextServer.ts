import 'server-only'

// Next server entry point. CLI evaluation imports the Node-compatible server
// adapter directly; any future app route should import this guarded entry.
export * from '@/lib/typesafeRecipeTaggingServer'
