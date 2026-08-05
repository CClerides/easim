'use client'

import type { PaymentScenario } from '@easim/mock-provider'

/**
 * Stands in for the card fields a real checkout would have.
 *
 * The brief forbids real card data anywhere on the site, including a mock
 * checkout - so there is no card number, expiry or security code field in this
 * codebase at all. What a reviewer needs instead is a way to choose which
 * outcome the payment provider will deliver, which is what this is.
 */

const OPTIONS: { value: PaymentScenario; label: string; description: string }[] = [
  {
    value: 'approve',
    label: 'Approve',
    description: 'Payment succeeds and the eSIM is delivered automatically.',
  },
  {
    value: 'decline',
    label: 'Decline',
    description: 'The provider refuses the payment. Nothing is charged or issued.',
  },
  {
    value: 'timeout',
    label: 'Never respond',
    description:
      'The provider goes silent. The order times out on its own after 90 seconds.',
  },
  {
    value: 'provider_failure',
    label: 'Pay, then fail to provision',
    description:
      'Payment succeeds, then provisioning fails. The order is kept and retried, never lost.',
  },
]

export function ScenarioSelector({
  value,
  onChange,
}: {
  value: PaymentScenario
  onChange: (next: PaymentScenario) => void
}) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium">Payment outcome</legend>
      <p className="text-sm text-muted">
        This is a mock payment service. Choose what it should do.
      </p>

      <div className="mt-4 space-y-2">
        {OPTIONS.map((option) => (
          <label
            key={option.value}
            className={`flex cursor-pointer gap-3 rounded-lg border p-4 transition-colors ${
              value === option.value
                ? 'border-accent bg-accent/5'
                : 'border-border hover:border-border/80'
            }`}
          >
            <input
              type="radio"
              name="scenario"
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="mt-1 accent-[var(--accent)]"
            />
            <span>
              <span className="block text-sm font-medium">{option.label}</span>
              <span className="mt-0.5 block text-sm text-muted">{option.description}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
