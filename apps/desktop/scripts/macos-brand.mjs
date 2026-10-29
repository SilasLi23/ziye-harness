/** Private macOS product identity and byte-checked delivered icon; Windows keeps upstream branding. */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import brand from '../resources/macos-brand.json' with { type: 'json' }

/** macOS display name, independent of runtime and application identifiers. */
export const macOSProductName = brand.productName
/** Delivered ICNS path, verified against the approved manifest fingerprint at load time. */
export const macOSIconPath = fileURLToPath(new URL('../resources/' + brand.icon, import.meta.url))
if (createHash('sha256').update(readFileSync(macOSIconPath)).digest('hex') !== brand.iconSha256) {
  throw new Error('desktop macOS branding: delivered ICNS fingerprint mismatch')
}
