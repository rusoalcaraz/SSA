import { type ReactNode, useEffect } from 'react'

interface Props {
  titulo: string
  onClose: () => void
  children: ReactNode
  className?: string
}

export function Modal({ titulo, onClose, children, className = '' }: Props) {
  useEffect(() => {
    const cont = document.getElementById('app-scroll')
    const scroller = cont || document.scrollingElement || document.documentElement
    const prevOverflow = (scroller as HTMLElement).style.overflow
    const prevScrollTop = scroller instanceof HTMLElement ? scroller.scrollTop : window.scrollY || 0
    if (scroller instanceof HTMLElement) {
      scroller.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'hidden'
    }

    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('keydown', handleKey)
      if (scroller instanceof HTMLElement) {
        scroller.style.overflow = prevOverflow
        scroller.scrollTo({ top: prevScrollTop, behavior: 'auto' })
      } else {
        document.body.style.overflow = prevOverflow
        window.scrollTo({ top: prevScrollTop, behavior: 'auto' })
      }
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className={`bg-white rounded-lg shadow-xl w-full max-w-md ${className}`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h3 className="text-base font-semibold text-gray-900">{titulo}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors text-lg leading-none"
          >
            ×
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  )
}
