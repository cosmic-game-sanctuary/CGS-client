import { Check, Copy } from 'lucide-react'
import { useEffect, useState } from 'react'
import { truncateAddress } from '@/lib/format'
import { cn } from '@/lib/utils'

/**
 * Your wallet's address, and a button that copies it.
 *
 * The funding route that works on every network and spends nothing of ours. A
 * Privy embedded wallet is an ordinary EVM address, so anything holding USDC on
 * Arc can send straight to it. **There is no second asset and no account to
 * open:** USDC is the gas token, so one transfer of one asset is the whole of
 * getting started.
 *
 * `full` prints every character. The funding step uses it, because on mainnet
 * this is the only way in and someone is checking what they pasted against it;
 * the 264px menu truncates.
 */
export function DepositAddress({
  address,
  label,
  note,
  full = false,
}: {
  address: string
  label: string
  note: string
  full?: boolean
}) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 1600)
    return () => clearTimeout(timer)
  }, [copied])

  async function copy() {
    try {
      await navigator.clipboard.writeText(address)
      setCopied(true)
    } catch {
      // Clipboard access can be refused outright, and a silent no-op reads as
      // a broken button. Selecting the text is the fallback everyone knows.
      setCopied(false)
    }
  }

  return (
    <div>
      <span className="label-micro text-ink-soft">{label}</span>
      <div className="mt-1.5 flex items-center gap-1.5">
        <code
          title={address}
          className={cn(
            'min-w-0 flex-1 rounded-md border-2 border-ink bg-paper px-2 py-1 font-mono',
            full ? 'text-[12px] break-all' : 'truncate text-[11px]',
          )}
        >
          {full ? address : truncateAddress(address, 10, 6)}
        </code>
        <button
          type="button"
          onClick={copy}
          aria-label="Copy your wallet address"
          className="flex shrink-0 cursor-pointer items-center gap-1 rounded-chip border-2 border-ink bg-paper px-2 py-1 font-mono text-[10px] font-bold tracking-wider uppercase transition-transform duration-130 hover:-translate-y-px active:translate-y-px"
        >
          {copied ? (
            <Check size={11} strokeWidth={3.5} className="text-green" />
          ) : (
            <Copy size={11} strokeWidth={3} />
          )}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <p className="mt-1.5 font-mono text-[10px] leading-relaxed text-ink-soft">
        {note}
      </p>
    </div>
  )
}
