/** Keep the private macOS branding separate from Windows packaging and runtime identity. */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { createElectronBuilderConfig } from '../scripts/electron-builder-config.mjs'

it('packages Silas with the delivered ICNS while preserving the selected application identity', () => {
  const config = createElectronBuilderConfig({ DSH_DESKTOP_UNSIGNED: '1', DSH_DESKTOP_APP_ID: 'com.example.unchanged' }, 'darwin', 'arm64')
  expect(config.productName).toBe('Silas')
  expect(config.appId).toBe('com.example.unchanged')
  expect(config.mac.icon).toMatch(/Silas-E1\.icns$/u)
  expect(createHash('sha256').update(readFileSync(config.mac.icon)).digest('hex')).toBe('eaa85748d400ecf0f0db9fa0124e16e8a97b65ba85eaef51f9adef5e95a7abdf')
  expect(config.mac.extendInfo.NSMicrophoneUsageDescription).toMatch(/^Silas /u)
})

it('retains the upstream Windows product and icon', () => {
  const config = createElectronBuilderConfig({ DSH_DESKTOP_UNSIGNED: '1', DSH_DESKTOP_APP_ID: 'com.example.windows',
    DSH_DESKTOP_MANDATORY_UPDATE_TEST_ORIGIN: 'https://policy.example.com',
    DSH_DESKTOP_MANDATORY_UPDATE_CONFIG: JSON.stringify({ allowedAuthOrigins: ['https://login.example.com'] }),
  }, 'win32', 'x64')
  expect(config.productName).toBe('DeepSeek Harness')
  expect(config.win.icon).toMatch(/icon-windows\.png$/u)
})
