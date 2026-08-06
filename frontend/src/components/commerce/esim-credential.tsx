import QRCode from 'qrcode'
import { CopyButton } from './copy-button'

/**
 * A delivered eSIM: the QR code you scan, and the ICCID you can type instead.
 *
 * The QR is rendered to a data URI on the server, so no image is ever fetched
 * and the activation code never travels anywhere it did not already need to.
 */
export async function EsimCredential({
  iccid,
  activationCode,
  region,
}: {
  iccid: string
  activationCode: string
  region: string
}) {
  const qrDataUri = await QRCode.toDataURL(activationCode, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 320,
    // Fixed black on white, never themed. Scanners need the contrast, and an
    // inverted QR is a QR that does not work - a beautiful, unusable card.
    // The white plate it sits on below is the quiet zone, for the same reason.
    color: { dark: '#000000', light: '#ffffff' },
  })

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <h3 className="font-medium">{region}</h3>
        <span className="rounded-full border border-success/40 px-2.5 py-1 text-xs text-success">
          Ready
        </span>
      </div>

      <div className="flex flex-col items-center gap-6 p-6 sm:flex-row sm:items-start">
        <div className="shrink-0 rounded-lg bg-white p-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- a data URI,
              already the right size; next/image would add a proxy for nothing. */}
          <img
            src={qrDataUri}
            alt={`Activation QR code for the ${region} eSIM`}
            width={200}
            height={200}
            className="size-[200px]"
          />
        </div>

        <div className="min-w-0 flex-1 space-y-4">
          <Field label="ICCID" value={iccid} />
          <Field label="Activation code" value={activationCode} />

          <p className="text-sm leading-relaxed text-muted">
            On your phone, open Settings → Mobile Service → Add eSIM and scan the
            code. If the camera will not cooperate, enter the activation code by
            hand.
          </p>
        </div>
      </div>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs tracking-wider text-muted uppercase">{label}</p>
      <div className="mt-1 flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate font-mono text-sm">{value}</code>
        <CopyButton value={value} label={label} />
      </div>
    </div>
  )
}
