import { Freehand } from '@/components/icons/Freehand'
import { Modal } from '@/components/ui/Modal'
import type { FreehandName } from '@/components/icons/Freehand'

/**
 * The pitch, kept off the shopfront and put behind one button on the landing
 * page. Everywhere else this is an ordinary games store (DESIGN.md §10).
 *
 * Written plainly. The story is strong enough without adjectives, and the
 * weakest thing we could do is oversell it.
 */

const POINTS: Array<{ icon: FreehandName; title: string; body: string }> = [
  {
    icon: 'business-deal-handshake',
    title: 'The money splits itself',
    body: 'A jam team sets who gets what before the first sale. Every purchase divides at settlement, so nobody holds anyone else’s money and nobody chases anyone on Discord three weeks later. The request for this at the biggest indie storefront has been open since 2016.',
  },
  {
    icon: 'money-wallet',
    title: 'It arrives now, not in a month',
    body: 'Elsewhere a payout means a tax interview, a minimum, a hold, another hold after you ask, then a review. For someone selling a few copies a month that is functionally never. Here it lands the minute someone buys.',
  },
  {
    icon: 'lock-key-1',
    title: 'You own the key, not a licence',
    body: 'Buying puts a key in your own wallet. It is not an entry in our database that we can revoke, and it keeps working if we disappear.',
  },
  {
    icon: 'security-shield-wall',
    title: 'No payment network gets a vote',
    body: 'In 2025 two card networks had thousands of games delisted from the biggest indie storefronts in a weekend. Plenty of them were nothing more than queer or slightly suggestive. Switching processors does not help, because they all route back to the same two companies. So we took the processor out of it.',
  },
]

export function WhyModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal
      size="lg"
      eyebrow="Cosmic Game Sanctuary"
      title="Why we built this"
      onClose={onClose}
    >
      <p className="max-w-[58ch] font-body text-[15px] leading-relaxed text-ink-soft">
        Four reasons, in the order they actually matter to the people using it.
      </p>

      <ul className="mt-5 flex list-none flex-col gap-5 p-0">
        {POINTS.map((point) => (
          <li key={point.title} className="flex items-start gap-4">
            <Freehand name={point.icon} className="h-11 w-11 shrink-0 text-ink" />
            <div>
              <h3 className="text-lg">{point.title}</h3>
              <p className="mt-1 max-w-[56ch] font-body text-[14.5px] leading-relaxed text-ink-soft">
                {point.body}
              </p>
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-6 border-t-2 border-ink pt-4 font-mono text-[11px] leading-relaxed text-ink-soft">
        Payment and ownership settle on a public distributed ledger. You never
        have to think about that, and nothing on this site will ask you to.
      </p>
    </Modal>
  )
}
