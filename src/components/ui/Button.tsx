import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

/**
 * Press physics — DESIGN.md §3. Hover lifts and the shadow grows; press pushes
 * the object down into its shadow. The object has thickness.
 */
const base =
  'font-wonk inline-flex items-center justify-center gap-2 border-2 border-ink rounded-card ' +
  'cursor-pointer select-none transition-[transform,box-shadow] duration-130 ease-out ' +
  'hover:-translate-x-px hover:-translate-y-px hover:shadow-hard-lg ' +
  'active:translate-x-0.5 active:translate-y-0.5 active:shadow-hard-sm ' +
  'disabled:opacity-45 disabled:pointer-events-none'

const variants = {
  /** Act now: buy, publish, the live price. Red means commitment. §1 */
  primary: 'bg-red text-paper shadow-hard',
  /** Money settled: play an owned game, confirm a payout. §1 */
  go: 'bg-green text-paper shadow-hard',
  neutral: 'bg-paper text-ink shadow-hard',
  ghost: 'bg-transparent text-ink shadow-none hover:shadow-hard-sm',
} as const

const sizes = {
  sm: 'text-[13px] px-3.5 py-1.5 shadow-hard-sm hover:shadow-hard',
  md: 'text-base px-5 py-2.5',
  lg: 'text-lg px-6 py-3',
} as const

export type ButtonVariant = keyof typeof variants
export type ButtonSize = keyof typeof sizes

interface CommonProps {
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
  children: ReactNode
}

export function Button({
  variant = 'neutral',
  size = 'md',
  className,
  children,
  ...rest
}: CommonProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(base, variants[variant], sizes[size], className)}
      {...rest}
    >
      {children}
    </button>
  )
}

export function ButtonLink({
  to,
  variant = 'neutral',
  size = 'md',
  className,
  children,
}: CommonProps & { to: string }) {
  return (
    <Link
      to={to}
      className={cn(base, variants[variant], sizes[size], 'no-underline', className)}
    >
      {children}
    </Link>
  )
}
