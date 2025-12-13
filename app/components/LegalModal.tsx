'use client'

type LegalModalProps = {
  title: string
  content: string
  onClose: () => void
}

export default function LegalModal({ title, content, onClose }: LegalModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl rounded-2xl bg-white dark:bg-[#0b1722] border border-white/10 shadow-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
          >
            ✕
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto space-y-3 text-sm text-gray-800 dark:text-gray-200">
          {content.split('\n').map((line, idx) => (
            <p key={idx} className="whitespace-pre-wrap leading-relaxed">
              {line.trim() === '' ? '\u00A0' : line}
            </p>
          ))}
        </div>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-bf-primary text-white hover:bg-bf-primary-dark transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

