'use client'

import { useEffect, useState } from 'react'
import { FileText } from 'lucide-react'

/**
 * Renders the first page of a PDF as a static image thumbnail, using the
 * same pdf.js engine that powers the full-screen PDF viewer (PdfItem).
 * Results are cached in-memory per pdfUrl so a page is only ever rendered
 * once per session, no matter how many cards reference it (Home, Je Traject, ...).
 */

const thumbnailCache = new Map<string, string>()
const pendingCache = new Map<string, Promise<string>>()

async function renderFirstPage(pdfUrl: string): Promise<string> {
  const cached = thumbnailCache.get(pdfUrl)
  if (cached) return cached

  const pending = pendingCache.get(pdfUrl)
  if (pending) return pending

  const promise = (async () => {
    const pdfjsLib = await import('pdfjs-dist')
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

    const pdf = await pdfjsLib.getDocument({ url: pdfUrl }).promise
    const page = await pdf.getPage(1)
    const viewport = page.getViewport({ scale: 1.5 })

    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('no-canvas-context')

    await page.render({ canvas, canvasContext: ctx, viewport }).promise
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
    thumbnailCache.set(pdfUrl, dataUrl)
    return dataUrl
  })()

  pendingCache.set(pdfUrl, promise)
  try {
    return await promise
  } finally {
    pendingCache.delete(pdfUrl)
  }
}

interface PdfThumbnailProps {
  pdfUrl: string | null
  /** Extra classes for the fallback / skeleton wrapper (should match the image sizing classes) */
  className?: string
}

export default function PdfThumbnail({ pdfUrl, className }: PdfThumbnailProps) {
  const [src, setSrc] = useState<string | null>(pdfUrl ? thumbnailCache.get(pdfUrl) ?? null : null)
  const [failed, setFailed] = useState(!pdfUrl)

  useEffect(() => {
    if (!pdfUrl) {
      setFailed(true)
      setSrc(null)
      return
    }
    const cached = thumbnailCache.get(pdfUrl)
    if (cached) {
      setSrc(cached)
      setFailed(false)
      return
    }

    let cancelled = false
    setFailed(false)
    setSrc(null)

    renderFirstPage(pdfUrl)
      .then((dataUrl) => {
        if (!cancelled) setSrc(dataUrl)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })

    return () => {
      cancelled = true
    }
  }, [pdfUrl])

  // Fallback: document icon (matches the locked/empty state used elsewhere for PDFs)
  if (failed) {
    return (
      <div
        className={className ?? 'absolute inset-0 flex items-center justify-center'}
        style={{ background: 'linear-gradient(135deg, #0d0f14 0%, #1a1f35 100%)' }}
      >
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: 'rgba(37,0,245,0.2)', border: '1px solid rgba(37,0,245,0.3)' }}
        >
          <FileText size={20} style={{ color: '#2500F5' }} />
        </div>
      </div>
    )
  }

  // Loading skeleton while pdf.js renders the first page
  if (!src) {
    return (
      <div
        className={className ?? 'absolute inset-0'}
        style={{ background: 'linear-gradient(135deg, #eef1f8 0%, #e2e7f5 100%)' }}
      />
    )
  }

  return <img src={src} alt="" className="absolute inset-0 w-full h-full object-cover" />
}
