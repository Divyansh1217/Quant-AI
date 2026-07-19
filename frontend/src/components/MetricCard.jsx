import clsx from 'clsx'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

export default function MetricCard({ label, value, sub, color, icon: Icon, trend }) {
  return (
    <div className="bg-bg-card border border-border rounded-xl p-4 card-glow transition-all duration-200 hover:border-border-bright group">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[10px] text-text-muted uppercase tracking-wider font-medium">{label}</p>
        {Icon && <Icon className="w-3.5 h-3.5 text-text-muted group-hover:text-text-secondary transition-colors" />}
      </div>
      <p className={clsx('text-xl font-bold tracking-tight', {
        'text-green': color === 'green',
        'text-red': color === 'red',
        'text-yellow': color === 'yellow',
        'text-accent': color === 'blue',
        'text-purple': color === 'purple',
        'text-cyan': color === 'cyan',
        'text-orange': color === 'orange',
        'text-text-primary': !color,
      })}>{value}</p>
      {sub && <p className="text-[10px] text-text-muted mt-1">{sub}</p>}
      {trend != null && (
        <div className={clsx('flex items-center gap-1 mt-1.5 text-[10px] font-medium', {
          'text-green': trend > 0,
          'text-red': trend < 0,
          'text-text-muted': trend === 0,
        })}>
          {trend > 0 ? <TrendingUp className="w-3 h-3" /> : trend < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
          {Math.abs(trend).toFixed(2)}%
        </div>
      )}
    </div>
  )
}
