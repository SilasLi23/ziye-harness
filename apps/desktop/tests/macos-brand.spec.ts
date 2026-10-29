/** Keep the private macOS branding separate from Windows packaging and runtime identity. */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { createElectronBuilderConfig } from '../scripts/electron-builder-config.mjs'

it('packages Silas with the delivered ICNS while preserving the selected application identity', () => {
  const config = createElectronBuilderConfig({ DSH_DESKTOP_UNSIGNED: '1', DSH_DESKTOP_APP_ID: 'com.example.unchanged' }, 'darwin', 'arm64')
  expect(config.productName).toBe('Silas')
  expect(config.appId).toBe('com.example.unchanged')
  expect(config.mac.icon).toMatch(/Silas\.icns$/u)
  expect(createHash('sha256').update(readFileSync(config.mac.icon)).digest('hex')).toBe('8f689acfad451956520a5b61541e2a25ca1d91d982f25311c941fc9d5527a720')
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
