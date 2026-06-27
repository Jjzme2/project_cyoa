'use client'

import { useState } from 'react'
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
  logs: string
  exitCode: number
  durationMs: number
}

export default function AdminTestsPage() {
  const { ready } = useAdminGuard()
  const { user } = useAuth()
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<RunResult | null>(null)

  async function runTests() {
    if (!user) return
    setRunning(true)
    setResult(null)
    try {
      const token = await user.getIdToken()
      const res = await fetch('/api/admin/tests', { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to run tests')
      setResult(data)
      toast[data.summary.success ? 'success' : 'error'](
        data.summary.success ? 'All tests passed' : `${data.summary.failed} test(s) failed`,
      )
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
      <AdminHeading eyebrow="Admin" title="Tests" subtitle="Run the Vitest suite and review results and logs in-app." />

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
          <p className="text-muted-foreground/55 text-sm">Run the suite to see results here.</p>
        </div>
      )}

      {result && s && (
        <>
          {/* Summary */}
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

          {/* Per-file */}
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

          {/* Raw logs */}
          <details className="glass-card rounded-xl border border-white/[0.07] overflow-hidden">
            <summary className="px-5 py-3 text-sm text-muted-foreground/60 cursor-pointer select-none hover:text-foreground/80">
              Raw output
            </summary>
            <pre className="px-5 py-3 text-[11px] leading-relaxed text-muted-foreground/55 bg-black/20 overflow-x-auto whitespace-pre-wrap border-t border-white/[0.06]">
              {result.logs || '(no output captured)'}
            </pre>
          </details>
        </>
      )}
    </main>
  )
}
