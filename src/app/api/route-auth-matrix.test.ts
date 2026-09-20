import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const apiRoot = dirname(fileURLToPath(import.meta.url))
const methodPattern = /export async function (GET|POST|PUT|PATCH|DELETE)\b/g
const authPattern = /(?:authenticateApiRequest|requireFamilyProfile|aiImportPOST)\s*\(/g
const riskyWorkPattern = /(?:createServerClient|safeFetch(?:Text|Image|Redirect)|openai\.chat\.completions\.create|aiComplete|\bfetch\s*\(|\.from\s*\(|fs\.)/

function findRouteFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return findRouteFiles(path)
    return entry.name === 'route.ts' ? [path] : []
  })
}

function methodBlocks(source: string) {
  const methods = [...source.matchAll(methodPattern)]
  return methods.map((match, index) => {
    const start = match.index ?? 0
    const end = methods[index + 1]?.index ?? source.length
    return { method: match[1], body: source.slice(start, end) }
  })
}

const routeFiles = findRouteFiles(apiRoot).sort()

describe('API route authentication matrix', () => {
  it('covers every API route source file', () => {
    expect(routeFiles.length).toBeGreaterThan(0)
    expect(routeFiles.map((file) => relative(apiRoot, file))).toContain('assistant/route.ts')
    expect(routeFiles.map((file) => relative(apiRoot, file))).toContain('recipes/[id]/route.ts')
  })

  for (const routeFile of routeFiles) {
    const source = readFileSync(routeFile, 'utf8')
    const routeName = relative(apiRoot, routeFile)

    it(`${routeName} does not import the service-role client`, () => {
      expect(source).not.toMatch(/supabase\/admin|createAdminClient/)
    })

    for (const { method, body } of methodBlocks(source)) {
      it(`${routeName} ${method} authenticates before risky work`, () => {
        const authMatch = authPattern.exec(body)
        authPattern.lastIndex = 0
        expect(authMatch).not.toBeNull()

        const authIndex = authMatch?.index ?? -1
        const riskyWorkIndex = body.search(riskyWorkPattern)
        if (riskyWorkIndex >= 0) {
          expect(authIndex).toBeLessThan(riskyWorkIndex)
        }
      })
    }
  }
})
