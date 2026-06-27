'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Play, CircleCheck, CircleX, FlaskConical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/components/Providers'
import { useAdminGuard, AdminSpinner, AdminHeading } from '../admin-ui'

interface TestFile {
  file: string
  status: string
  total: number
  passed: number
  failed: number
  durationMs: number | null
  failures: { title: string; message: string }[]
}
interface RunResult {
  summary: { success: boolean; totalFiles?: number; totalTests?: number; passed?: number; failed?: number }
  files: TestFile[]
  exitCode: number
  durationMs: number
}

const MAX_LOG_CHARS = 100_000

export default function AdminTestsPage() {
  const { ready } = useAdminGuard()
  const { user } = useAuth()
  const [running, setRunning] = useState(false)
  const [logs, setLogs] = useState('')
  const [result, setResult] = useState<RunResult | null>(null)
  const logRef = useRef<HTMLPreElement | null>(null)

  // Keep the live log scrolled to the bottom as chunks arrive (DOM side effect).
  useEffect(() => {
    if (running && logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [logs, running])

  async function runTests() {
    if (!user) return
    setRunning(true)
    setResult(null)
    setLogs('')
    try {
      const token = await user.getIdToken()
      const res = await fetch('/api/admin/tests', { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Failed to run tests')
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let final: RunResult | null = null

      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? '' // keep the trailing partial line
        for (const line of lines) {
          if (!line.trim()) continue
          let evt: { type: string; chunk?: string; error?: string } & Partial<RunResult>
          try {
            evt = JSON.parse(line)
          } catch {
            continue
          }
          if (evt.type === 'log' && evt.chunk) {
            const chunk = evt.chunk
            setLogs((prev) => (prev + chunk).slice(-MAX_LOG_CHARS))
          } else if (evt.type === 'done') {
            final = evt as RunResult
            setResult(final)
          } else if (evt.type === 'error') {
            throw new Error(evt.error ?? 'Test run failed')
          }
        }
      }

      if (final) {
        toast[final.summary.success ? 'success' : 'error'](
          final.summary.success ? 'All tests passed' : `${final.summary.failed} test(s) failed`,
        )
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to run tests')
    } finally {
      setRunning(false)
    }
  }

  if (!ready) return <AdminSpinner />

  const s = result?.summary
  const ok = !!s?.success

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12 space-y-8">
      <AdminHeading eyebrow="Admin" title="Tests" subtitle="Run the Vitest suite and watch results and logs stream in live." />

      <Button
        onClick={runTests}
        disabled={running}
        className="gap-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300"
      >
        {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
        {running ? 'Running tests…' : 'Run tests'}
      </Button>

      {!result && !running && (
        <div className="glass-card rounded-xl p-12 text-center border border-white/[0.07] space-y-2">
          <FlaskConical className="h-6 w-6 text-amber-400/40 mx-auto" />
          <p className="text-muted-foreground/55 text-sm">Run the suite to see results and logs here.</p>
        </div>
      )}

      {/* Summary */}
      {result && s && (
        <div
          className={`glass-card rounded-xl p-5 border ${ok ? 'border-emerald-500/20' : 'border-red-500/25'} flex items-center gap-4`}
        >
          {ok ? (
            <CircleCheck className="h-7 w-7 text-emerald-400/80 shrink-0" />
          ) : (
            <CircleX className="h-7 w-7 text-red-400/80 shrink-0" />
          )}
          <div className="flex-1">
            <p className={`text-lg font-bold ${ok ? 'text-emerald-300' : 'text-red-300'}`}>
              {s.passed}/{s.totalTests} tests passed
            </p>
            <p className="text-xs text-muted-foreground/50">
              {s.totalFiles} files · {s.failed ?? 0} failed · {(result.durationMs / 1000).toFixed(1)}s
            </p>
          </div>
        </div>
      )}

      {/* Per-file */}
      {result && (
        <div className="space-y-2">
          {result.files.map((f) => {
            const filePassed = f.failed === 0
            return (
              <div key={f.file} className="glass-card rounded-xl p-4 border border-white/[0.07] space-y-2">
                <div className="flex items-center gap-2.5">
                  {filePassed ? (
                    <CircleCheck className="h-4 w-4 text-emerald-400/70 shrink-0" />
                  ) : (
                    <CircleX className="h-4 w-4 text-red-400/70 shrink-0" />
                  )}
                  <span className="text-sm font-mono text-foreground/75 truncate flex-1">{f.file}</span>
                  <span className="text-[11px] tabular-nums text-muted-foreground/50 shrink-0">
                    {f.passed}/{f.total}
                    {f.durationMs != null && ` · ${f.durationMs}ms`}
                  </span>
                </div>
                {f.failures.length > 0 && (
                  <div className="space-y-1.5 pl-6">
                    {f.failures.map((fail, i) => (
                      <div key={i} className="text-[11px]">
                        <p className="text-red-300/80 font-medium">{fail.title}</p>
                        <pre className="mt-1 whitespace-pre-wrap text-muted-foreground/55 bg-black/20 rounded p-2 overflow-x-auto">
                          {fail.message}
                        </pre>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Live / final logs */}
      {(running || logs) && (
        <div className="glass-card rounded-xl border border-white/[0.07] overflow-hidden">
          <div className="px-5 py-2.5 text-sm text-muted-foreground/60 border-b border-white/[0.06] flex items-center gap-2">
            {running && <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-400/60" />}
            {running ? 'Live output' : 'Output'}
          </div>
          <pre
            ref={logRef}
            className="px-5 py-3 text-[11px] leading-relaxed text-muted-foreground/55 bg-black/20 overflow-auto whitespace-pre-wrap max-h-[28rem]"
          >
            {logs || 'Starting…'}
          </pre>
        </div>
      )}
    </main>
  )
}
