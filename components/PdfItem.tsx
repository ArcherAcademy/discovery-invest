'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight, Download, Expand, FileText, Lock, RotateCcw } from 'lucide-react'

interface Props {
  title: string
  description: string
  pdfUrl: string | null
  videoDbId: string
  locked?: boolean
  onOpened?: () => void
}

export default function PdfItem({ title, description, pdfUrl, videoDbId, locked = false, onOpened }: Props) {
  const [registeredOpen, setRegisteredOpen] = useState(false)
  const [numPages, setNumPages] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pdfDocRef = useRef<any>(null)
  const renderTaskRef = useRef<any>(null)

  const registerOpen = useCallback(async () => {
    if (registeredOpen) return
    try {
      const res = await fetch('/api/video-complete', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId: videoDbId }),
      })
      if (res.ok) {
        setRegisteredOpen(true)
        onOpened?.()
      }
    } catch {
      // silent — tracking is best-effort
    }
  }, [registeredOpen, videoDbId, onOpened])

  // Load the PDF document with pdf.js. Native <iframe src="file.pdf">
  // rendering only works on browsers with a built-in PDF plugin (desktop
  // Chrome/Safari/Firefox) — most mobile browsers and in-app webviews have
  // none, so the iframe shows a broken-document icon instead of the file.
  // Rendering pages to <canvas> ourselves works identically everywhere.
  useEffect(() => {
    if (!pdfUrl) return
    let cancelled = false
    setStatus('loading')
    setNumPages(0)
    setCurrentPage(1)

    ;(async () => {
      try {
        const pdfjsLib = await import('pdfjs-dist')
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
        const pdf = await pdfjsLib.getDocument({ url: pdfUrl }).promise
        if (cancelled) return
        pdfDocRef.current = pdf
        setNumPages(pdf.numPages)
      } catch {
        if (!cancelled) setStatus('error')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [pdfUrl])

  const renderPage = useCallback(
    async (pageNum: number) => {
      const pdf = pdfDocRef.current
      const canvas = canvasRef.current
      const container = containerRef.current
      if (!pdf || !canvas || !container) return

      try {
        renderTaskRef.current?.cancel()
        const page = await pdf.getPage(pageNum)
        const unscaledViewport = page.getViewport({ scale: 1 })
        const containerWidth = container.clientWidth
        const scale = containerWidth / unscaledViewport.width
        const dpr = Math.min(window.devicePixelRatio || 1, 2)
        const viewport = page.getViewport({ scale: scale * dpr })

        canvas.width = viewport.width
        canvas.height = viewport.height
        canvas.style.width = `${viewport.width / dpr}px`
        canvas.style.height = `${viewport.height / dpr}px`

        const ctx = canvas.getContext('2d')
        if (!ctx) return
        const task = page.render({ canvasContext: ctx, viewport })
        renderTaskRef.current = task
        await task.promise
        setStatus('ready')
        registerOpen()
      } catch (err: any) {
        if (err?.name !== 'RenderingCancelledException') {
          setStatus('error')
        }
      }
    },
    [registerOpen]
  )

  useEffect(() => {
    if (numPages > 0) renderPage(currentPage)
  }, [currentPage, numPages, renderPage])

  useEffect(() => {
    function onResize() {
      if (numPages > 0) renderPage(currentPage)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [numPages, currentPage, renderPage])

  function handleDownload() {
    if (!pdfUrl) return
    const a = document.createElement('a')
    a.href = pdfUrl
    a.download = title.replace(/\s+/g, '-').toLowerCase() + '.pdf'
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  function handleFullscreen() {
    if (!pdfUrl) return
    window.open(pdfUrl, '_blank', 'noopener,noreferrer')
  }

  if (locked || !pdfUrl) {
    return (
      <div
        className="w-full rounded-2xl flex flex-col items-center justify-center gap-4 py-16"
        style={{ background: 'linear-gradient(135deg, #0d0f14 0%, #1a1f35 100%)', minHeight: 340 }}
      >
        <div
          className="w-14 h-14 rounded-xl flex items-center justify-center"
          style={{ background: 'rgba(37,0,245,0.15)', border: '1px solid rgba(37,0,245,0.25)' }}
        >
          {locked
            ? <Lock size={24} style={{ color: 'rgba(255,255,255,0.35)' }} />
            : <FileText size={24} style={{ color: '#2500F5' }} />
          }
        </div>
        <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>
          {locked ? "Vrijgespeeld na 6/6 kernvideo's" : 'Binnenkort beschikbaar'}
        </p>
      </div>
    )
  }

  return (
    <div
      className="w-full rounded-2xl overflow-hidden flex flex-col"
      style={{
        background: 'linear-gradient(160deg, #eef1f8 0%, #e8ecf6 100%)',
        boxShadow: '0 4px 24px rgba(13,15,20,0.12)',
      }}
    >
      {/* Top bar — stacks on mobile so the two action buttons never get squeezed against the title */}
      <div
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 sm:px-5 py-3 shrink-0"
        style={{ borderBottom: '1px solid rgba(13,15,20,0.08)', background: 'rgba(255,255,255,0.7)' }}
      >
        {/* Left: icon + title */}
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: '#2500F5' }}
          >
            <FileText size={14} color="#fff" />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] font-bold tracking-[0.14em] uppercase" style={{ color: '#2500F5' }}>
              PDF-gids
            </p>
            <p className="text-sm font-bold leading-tight truncate" style={{ color: '#0d0f14' }}>{title}</p>
          </div>
        </div>

        {/* Right: actions — full-width even split on mobile, inline on desktop */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleDownload}
            className="flex flex-1 sm:flex-initial items-center justify-center gap-1.5 text-xs font-medium px-3 py-2 sm:py-1.5 rounded-lg transition-colors hover:bg-white"
            style={{ color: 'rgba(13,15,20,0.6)', border: '1px solid rgba(13,15,20,0.12)' }}
          >
            <Download size={12} />
            Download
          </button>
          <button
            onClick={handleFullscreen}
            className="flex flex-1 sm:flex-initial items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2 sm:py-1.5 rounded-lg transition-all hover:opacity-90"
            style={{ background: '#2500F5', color: '#fff', boxShadow: '0 2px 8px rgba(37,0,245,0.3)' }}
          >
            <Expand size={12} />
            Volledig scherm
          </button>
        </div>
      </div>

      {/* Canvas PDF viewer — pages are rendered client-side with pdf.js so
          this works consistently across desktop and mobile browsers, unlike
          an <iframe src="file.pdf"> which relies on a native PDF plugin that
          most mobile browsers don't have. */}
      <div ref={containerRef} className="w-full relative flex items-center justify-center px-4 py-6" style={{ minHeight: 320 }}>
        {status === 'loading' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 py-16">
            <div
              className="w-8 h-8 rounded-full border-2 animate-spin"
              style={{ borderColor: 'rgba(37,0,245,0.15)', borderTopColor: '#2500F5' }}
            />
            <p className="text-xs font-medium" style={{ color: 'rgba(13,15,20,0.4)' }}>PDF wordt geladen&hellip;</p>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center px-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(13,15,20,0.06)' }}
            >
              <FileText size={20} style={{ color: 'rgba(13,15,20,0.35)' }} />
            </div>
            <p className="text-sm font-medium" style={{ color: 'rgba(13,15,20,0.55)' }}>
              De PDF kon niet worden weergegeven.
            </p>
            <button
              onClick={() => renderPage(currentPage)}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg transition-all hover:opacity-90"
              style={{ background: '#2500F5', color: '#fff' }}
            >
              <RotateCcw size={12} />
              Opnieuw proberen
            </button>
          </div>
        )}

        <canvas
          ref={canvasRef}
          className="rounded-lg shadow-sm"
          style={{ display: status === 'ready' ? 'block' : 'none', maxWidth: '100%' }}
        />
      </div>

      {/* Page navigation — only shown for multi-page documents */}
      {numPages > 1 && (
        <div
          className="flex items-center justify-center gap-4 px-4 py-3 shrink-0"
          style={{ borderTop: '1px solid rgba(13,15,20,0.08)', background: 'rgba(255,255,255,0.7)' }}
        >
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            aria-label="Vorige pagina"
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors disabled:opacity-30"
            style={{ background: '#f0f3fb', color: '#0d0f14' }}
          >
            <ChevronLeft size={16} />
          </button>
          <p className="text-xs font-medium tabular-nums" style={{ color: 'rgba(13,15,20,0.6)' }}>
            Pagina {currentPage} van {numPages}
          </p>
          <button
            onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
            disabled={currentPage >= numPages}
            aria-label="Volgende pagina"
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors disabled:opacity-30"
            style={{ background: '#f0f3fb', color: '#0d0f14' }}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  )
}
