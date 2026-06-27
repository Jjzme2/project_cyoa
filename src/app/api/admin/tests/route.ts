import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'node:child_process'
import { readFile, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { getAuthContext } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

const RUN_TIMEOUT_MS = 90_000
const MAX_LOG_CHARS = 100_000

interface AssertionResult {
  title: string
  status: string
  duration?: number | null
  failureMessages?: string[]
}
interface FileResult {
  name: string
  status: string
  assertionResults: AssertionResult[]
  startTime?: number
  endTime?: number
}

/** Whether the in-app test runner is permitted in this environment. */
function runnerEnabled(): boolean {
  return process.env.NODE_ENV !== 'production' || process.env.ENABLE_ADMIN_TEST_RUNNER === 'true'
}

function stripAnsi(s: string): string {
  return s.replace(/\[[0-9;]*m/g, '')
}

/** Admin-only: run the Vitest suite and return structured results + logs. */
export async function POST(req: NextRequest) {
  const auth = await getAuthContext(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!auth.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (!runnerEnabled()) {
    return NextResponse.json(
      { error: 'The in-app test runner is disabled in production. Set ENABLE_ADMIN_TEST_RUNNER=true to enable.' },
      { status: 400 },
    )
  }

  const cwd = process.cwd()
  const tmp = await mkdtemp(join(tmpdir(), 'admin-vitest-'))
  const outFile = join(tmp, 'results.json')
  const startedAt = Date.now()

  try {
    // Fixed command — no user input reaches the args, and no shell is used.
    const bin = join(cwd, 'node_modules', '.bin', 'vitest')
    const child = spawn(
      bin,
      ['run', '--reporter=default', '--reporter=json', `--outputFile.json=${outFile}`],
      { cwd, env: { ...process.env, CI: 'true', NO_COLOR: '1', FORCE_COLOR: '0' } },
    )

    let logs = ''
    const append = (d: Buffer) => {
      if (logs.length < MAX_LOG_CHARS) logs += d.toString()
    }
    child.stdout.on('data', append)
    child.stderr.on('data', append)

    const timer = setTimeout(() => child.kill('SIGKILL'), RUN_TIMEOUT_MS)
    const exitCode: number = await new Promise((resolve) => {
      child.on('close', (code) => resolve(code ?? 1))
      child.on('error', () => resolve(1))
    })
    clearTimeout(timer)

    const durationMs = Date.now() - startedAt
    logs = stripAnsi(logs).slice(0, MAX_LOG_CHARS)

    // Parse the structured report; degrade gracefully if it wasn't written.
    let summary: Record<string, unknown> = { success: exitCode === 0 }
    let files: unknown[] = []
    try {
      const report = JSON.parse(await readFile(outFile, 'utf8'))
      summary = {
        success: !!report.success,
        // numTotalTestSuites counts describe blocks; the real file count is the
        // length of testResults.
        totalFiles: (report.testResults ?? []).length,
        totalTests: report.numTotalTests ?? 0,
        passed: report.numPassedTests ?? 0,
        failed: report.numFailedTests ?? 0,
      }
      files = (report.testResults ?? []).map((f: FileResult) => {
        const assertions = f.assertionResults ?? []
        return {
          file: relative(cwd, f.name),
          status: f.status,
          total: assertions.length,
          passed: assertions.filter((a) => a.status === 'passed').length,
          failed: assertions.filter((a) => a.status === 'failed').length,
          durationMs: f.startTime && f.endTime ? f.endTime - f.startTime : null,
          failures: assertions
            .filter((a) => a.status === 'failed')
            .map((a) => ({ title: a.title, message: stripAnsi((a.failureMessages ?? []).join('\n')).slice(0, 4000) })),
        }
      })
    } catch {
      // No JSON report (crash/timeout) — the logs still tell the story.
    }

    return NextResponse.json({ summary, files, logs, exitCode, durationMs })
  } catch (err) {
    console.error('[admin/tests] run failed:', err)
    return NextResponse.json({ error: 'Failed to run tests' }, { status: 500 })
  } finally {
    await rm(tmp, { recursive: true, force: true }).catch(() => {})
  }
}
