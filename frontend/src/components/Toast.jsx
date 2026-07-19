import { useEffect, useState } from 'react'
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react'

let _addToast = null

export function toast(message, type = 'info') {
  if (_addToast) _addToast(message, type)
}

const icons = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
}
const styles = {
  success: 'border-green/30 bg-green/10 text-green',
  error: 'border-red/30 bg-red/10 text-red',
  info: 'border-accent/30 bg-accent/10 text-accent',
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState([])

  useEffect(() => {
    _addToast = (message, type) => {
      const id = Date.now()
      setToasts(prev => [...prev, { id, message, type }])
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
    }
    return () => { _addToast = null }
  }, [])

  if (!toasts.length) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2">
      {toasts.map(t => {
        const Icon = icons[t.type] || Info
        return (
          <div key={t.id} className={`flex items-center gap-3 px-4 py-3 rounded-xl border glass animate-slideInLeft ${styles[t.type]}`}>
            <Icon className="w-4 h-4 flex-shrink-0" />
            <p className="text-sm font-medium">{t.message}</p>
            <button onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))} className="ml-2 opacity-60 hover:opacity-100">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
