export default function SkeletonLoader({ rows = 3, className = '' }) {
  return (
    <div className={`space-y-4 ${className}`}>
      <div className="skeleton h-12 w-full" />
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton h-20 w-full" style={{ animationDelay: `${i * 0.05}s` }} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton h-10 w-full" style={{ animationDelay: `${i * 0.08}s` }} />
      ))}
    </div>
  )
}

export function SkeletonCard() {
  return (
    <div className="bg-bg-card border border-border rounded-xl p-5 space-y-3">
      <div className="skeleton h-5 w-1/3" />
      <div className="skeleton h-8 w-1/2" />
      <div className="skeleton h-4 w-2/3" />
    </div>
  )
}

export function SkeletonChart() {
  return (
    <div className="bg-bg-card border border-border rounded-xl p-5">
      <div className="skeleton h-5 w-1/4 mb-4" />
      <div className="skeleton h-[300px] w-full" />
    </div>
  )
}
