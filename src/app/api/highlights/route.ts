import { NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import { authenticateApiRequest } from '@/lib/apiSecurity'
import { apiErrorResponse } from '@/lib/apiErrors'
import { assertRequestContentLength, parseJsonRequest } from '@/lib/validation'
import { isTrainingEnabled } from '@/lib/trainingAvailability'

const DATASET_DIR = path.join(process.cwd(), 'data/ingredient_highlights')

type HighlightDataset = {
  id: string
  title?: string
  ingredients: unknown
  instructions: unknown
  expectedMatches?: Record<string, string[]>
}

const expectedMatchesSchema = z.record(
  z.string().trim().min(1).max(100),
  z.array(z.string().trim().min(1).max(100)).max(200),
).superRefine((value, context) => {
  if (Object.keys(value).length > 2_000) {
    context.addIssue({ code: 'custom', message: 'Too many expected matches' })
  }
})

const highlightUpdateSchema = z.object({
  id: z.string().trim().min(1).max(200),
  expectedMatches: expectedMatchesSchema,
}).strict()

function listDatasetFiles(): string[] {
  if (!fs.existsSync(DATASET_DIR)) return []
  return fs.readdirSync(DATASET_DIR).filter((f) => f.endsWith('.json'))
}

function readDataset(filePath: string): HighlightDataset {
  const payload = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  return payload as HighlightDataset
}

const LOG_PATH = path.join(DATASET_DIR, 'label_log.json')

function appendLog(id: string) {
  try {
    const entry = { id, ts: new Date().toISOString() }
    if (!fs.existsSync(LOG_PATH)) {
      fs.writeFileSync(LOG_PATH, JSON.stringify([entry], null, 2) + '\n', 'utf-8')
      return
    }
    const existing = JSON.parse(fs.readFileSync(LOG_PATH, 'utf-8'))
    const next = Array.isArray(existing) ? [...existing, entry] : [entry]
    fs.writeFileSync(LOG_PATH, JSON.stringify(next, null, 2) + '\n', 'utf-8')
  } catch {
    // Best effort logging; ignore failures
  }
}

function findDatasetPathById(id: string): string | null {
  for (const file of listDatasetFiles()) {
    const full = path.join(DATASET_DIR, file)
    try {
      const data = readDataset(full)
      if (data.id === id) {
        return full
      }
    } catch {
      // ignore bad file
    }
  }
  return null
}

export async function GET(req: Request) {
  if (!isTrainingEnabled()) {
    return NextResponse.json({ success: false, error: 'Not found', code: 'NOT_FOUND' }, { status: 404 })
  }
  const auth = await authenticateApiRequest(req)
  if (auth.error) return auth.error

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  if (!id) {
    const files = listDatasetFiles()
    const list = files.map((file) => {
      try {
        const payload = readDataset(path.join(DATASET_DIR, file))
        return { id: payload.id, title: payload.title, file }
      } catch {
        return null
      }
    })
    return NextResponse.json({ datasets: list.filter(Boolean) })
  }

  const targetPath = findDatasetPathById(id)
  if (!targetPath) {
    return NextResponse.json({ success: false, error: 'Dataset not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  try {
    const payload = readDataset(targetPath)
    return NextResponse.json(payload)
  } catch (error) {
    return apiErrorResponse(error)
  }
}

export async function POST(req: Request) {
  if (!isTrainingEnabled()) {
    return NextResponse.json({ success: false, error: 'Not found', code: 'NOT_FOUND' }, { status: 404 })
  }
  const auth = await authenticateApiRequest(req, { stateChanging: true })
  if (auth.error) return auth.error

  try {
    assertRequestContentLength(req, 1 * 1024 * 1024)
    const { id, expectedMatches } = await parseJsonRequest(req, highlightUpdateSchema, 1 * 1024 * 1024)

    const targetPath = findDatasetPathById(id)
    if (!targetPath) {
      return NextResponse.json({ success: false, error: 'Dataset not found', code: 'NOT_FOUND' }, { status: 404 })
    }

    const payload = readDataset(targetPath)
    payload.expectedMatches = expectedMatches
    fs.writeFileSync(targetPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8')
    appendLog(payload.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    return apiErrorResponse(error)
  }
}
