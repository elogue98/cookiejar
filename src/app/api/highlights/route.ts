import { NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'

const DATASET_DIR = path.join(process.cwd(), 'data/ingredient_highlights')

type HighlightDataset = {
  id: string
  title?: string
  ingredients: unknown
  instructions: unknown
  expectedMatches?: Record<string, string[]>
}

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
    return NextResponse.json({ error: 'Dataset not found' }, { status: 404 })
  }

  try {
    const payload = readDataset(targetPath)
    return NextResponse.json(payload)
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { id, expectedMatches } = body as { id?: string; expectedMatches?: Record<string, string[]> }
    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    }
    if (!expectedMatches || typeof expectedMatches !== 'object') {
      return NextResponse.json({ error: 'expectedMatches required' }, { status: 400 })
    }

    const targetPath = findDatasetPathById(id)
    if (!targetPath) {
      return NextResponse.json({ error: 'Dataset not found' }, { status: 404 })
    }

    const payload = readDataset(targetPath)
    payload.expectedMatches = expectedMatches
    fs.writeFileSync(targetPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8')
    appendLog(payload.id)

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
