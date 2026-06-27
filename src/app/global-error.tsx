'use client'

import { useEffect } from 'react'

/**
 * Last-resort boundary for errors thrown in the root layout itself. It replaces
 * the entire document, so it ships its own <html>/<body> and self-contained
 * styles rather than relying on the app shell.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[global error]', error)
  }, [error])

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0a0a0f',
          color: '#e7e3d8',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div style={{ textAlign: 'center', padding: '2rem', maxWidth: 420 }}>
          <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', color: '#fbbf24' }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: '0.9rem', opacity: 0.6, marginBottom: '1.5rem' }}>
            The application hit an unexpected error. Please try again.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              padding: '0.5rem 1.25rem',
              borderRadius: 8,
              border: '1px solid rgba(251,191,36,0.3)',
              background: 'rgba(251,191,36,0.2)',
              color: '#fcd34d',
              cursor: 'pointer',
              fontSize: '0.9rem',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
