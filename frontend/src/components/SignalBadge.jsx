import clsx from 'clsx'

const colors = {
  BUY: 'bg-green/15 text-green border-green/30 shadow-[0_0_12px_rgba(34,197,94,0.15)]',
  SELL: 'bg-red/15 text-red border-red/30 shadow-[0_0_12px_rgba(239,68,68,0.15)]',
  HOLD: 'bg-yellow/15 text-yellow border-yellow/30 shadow-[0_0_12px_rgba(234,179,8,0.15)]',
  BULLISH: 'bg-green/15 text-green border-green/30',
  BEARISH: 'bg-red/15 text-red border-red/30',
  NEUTRAL: 'bg-yellow/15 text-yellow border-yellow/30',
}

export default function SignalBadge({ signal, size = 'md' }) {
  const upper = signal?.toUpperCase()
  const colorClass = colors[upper] || 'bg-bg-card text-text-secondary border-border'
  return (
    <span className={clsx(
      'inline-flex items-center border rounded-full font-bold tracking-wider uppercase',
      colorClass,
      size === 'xs' && 'px-2 py-0.5 text-[9px]',
      size === 'sm' && 'px-2.5 py-0.5 text-[10px]',
      size === 'md' && 'px-3.5 py-1 text-xs',
      size === 'lg' && 'px-5 py-1.5 text-sm',
    )}>
      {upper}
    </span>
  )
}
