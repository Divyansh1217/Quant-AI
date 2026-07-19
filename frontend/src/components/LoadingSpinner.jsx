export default function LoadingSpinner({ text = 'Loading...' }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <div className="w-10 h-10 border-3 border-accent/30 border-t-accent rounded-full animate-spin" />
      <p className="text-sm text-text-muted animate-pulse">{text}</p>
    </div>
  )
}
