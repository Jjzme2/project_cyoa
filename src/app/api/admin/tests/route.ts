import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'node:child_process'
import { readFile, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { getAuthContext } from '@/lib/auth'

// Route handlers run on the Node.js runtime by default (needed for
// child_process/fs here), and a POST handler is inherently dynamic — so no
// `runtime`/`dynamic` exports, which are incompatible with cacheComponents.
export const maxDuration = 120

const RUN_TIMEOUT_MS = 90_000

interface AssertionResult {
  title: string
  status: string
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
  return s.replace(/\[[0-9;]*m/g, '')
}

/** Build the structured summary + per-file results from Vitest's JSON report. */
function summarize(report: Record<string, unknown>, cwd: string) {
  const testResults = (report.testResults as FileResult[] | undefined) ?? []
  const summary = {
    success: !!report.success,
    totalFiles: testResults.length,
    totalTests: (report.numTotalTests as number) ?? 0,
    passed: (report.numPassedTests as number) ?? 0,
    failed: (report.numFailedTests as number) ?? 0,
  }
  const files = testResults.map((f) => {
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
  return { summary, files }
}

/**
 * Admin-only: run the Vitest suite, streaming log output live as NDJSON
 * (`{type:'log'}` chunks, then a final `{type:'done'}` with the structured
 * summary). Auth/gating failures return a normal JSON error before the stream.
 */
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
  const bin = join(cwd, 'node_modules', '.bin', 'vitest')

  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder()
      let closed = false
      const send = (obj: unknown) => {
        if (!closed) controller.enqueue(enc.encode(JSON.stringify(obj) + '\n'))
      }
      const close = async () => {
        if (closed) return
        closed = true
        controller.close()
        await rm(tmp, { recursive: true, force: true }).catch(() => {})
      }

      let child
      try {
        // Fixed command — no user input reaches the args, and no shell is used.
        child = spawn(
          bin,
          ['run', '--reporter=default', '--reporter=json', `--outputFile.json=${outFile}`],
          { cwd, env: { ...process.env, CI: 'true', NO_COLOR: '1', FORCE_COLOR: '0' } },
        )
      } catch (err) {
        console.error('[admin/tests] spawn failed:', err)
        send({ type: 'error', error: 'Failed to start the test runner' })
        void close()
        return
      }

      const timer = setTimeout(() => child.kill('SIGKILL'), RUN_TIMEOUT_MS)
      const onChunk = (d: Buffer) => send({ type: 'log', chunk: stripAnsi(d.toString()) })
      child.stdout.on('data', onChunk)
      child.stderr.on('data', onChunk)

      child.on('error', () => {
        clearTimeout(timer)
        send({ type: 'error', error: 'The test runner failed to execute' })
        void close()
      })

      child.on('close', async (code) => {
        clearTimeout(timer)
        const exitCode = code ?? 1
        const durationMs = Date.now() - startedAt
        let payload: Record<string, unknown> = { summary: { success: exitCode === 0 }, files: [] }
        try {
          payload = summarize(JSON.parse(await readFile(outFile, 'utf8')), cwd)
        } catch {
          // No JSON report (crash/timeout) — the streamed logs still tell the story.
        }
        send({ type: 'done', ...payload, exitCode, durationMs })
        void close()
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store, no-transform',
      'X-Accel-Buffering': 'no',
    },
  })
}
