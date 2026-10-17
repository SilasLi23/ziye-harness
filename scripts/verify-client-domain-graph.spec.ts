import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describe, expect, it, type TestContext } from 'vitest'
import { resolveClientImport, scanClientDomains } from './verify-client-domain-graph.ts'

function clientFixture(test: TestContext, files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'dsh-client-domain-'))
  test.onTestFinished(() => { rmSync(root, { recursive: true, force: true }) })
  for (const [name, source] of Object.entries(files)) {
    const path = join(root, 'fixture/src/client', name)
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, source)
  }
  return root
}

describe('Client domain ownership', () => {
  it('accepts shared image assets without admitting code or CSS as assets', (test) => {
    const root = clientFixture(test, {
      'Page.tsx': "import logo from './assets/logo.svg'; import image from './assets/welcome.webp'; import helper from './assets/helper.ts'; import css from './assets/private.module.css';",
    })
    expect(scanClientDomains(root).map(item => item.imported)).toEqual(['./assets/helper.ts', './assets/private.module.css'])
  })

  it('does not interpret strings and comments as imports', (test) => {
    const root = clientFixture(test, { 'Page.tsx': 'const text = "from \'./private/hidden.ts\'"; // from \'./other/hidden.ts\'\nexport {}' })
    expect(scanClientDomains(root)).toEqual([])
  })

  it('checks side-effect imports, dynamic imports, and require calls across domains', (test) => {
    const root = clientFixture(test, {
      'input/owner.ts': "import '../chat/side-effect.ts'; const load = () => import('../queue/private.ts'); const other = require('../history/private.ts');",
    })
    expect(scanClientDomains(root).map(item => item.imported)).toEqual(['../chat/side-effect.ts', '../queue/private.ts', '../history/private.ts'])
  })

  it('retains the assembly and shared-contract boundary', (test) => {
    const root = clientFixture(test, {
      'apply.ts': "import { first } from './input/first.ts'; import { second } from './chat/second.ts';",
      'input/first.ts': "import type { Shared } from '../contract/shared.ts'; import type { Private } from '../chat/private.ts';",
    })
    expect(scanClientDomains(root).map(item => item.imported)).toEqual(['../chat/private.ts'])
  })

  it('rejects an empty source corpus instead of reporting a clean graph', (test) => {
    const root = clientFixture(test, {})
    expect(() => scanClientDomains(root)).toThrow(/no Client source files/)
  })
})

describe('client domain import resolution', () => {
  it('preserves imports that leave src/client from a top-level file', () => {
    expect(resolveClientImport('styles.ts', '../styles/base.css?inline'))
      .toBe('../styles/base.css?inline')
  })

  it('normalizes imports between domains inside src/client', () => {
    expect(resolveClientImport('input/hub.ts', '../queue/store.ts'))
      .toBe('queue/store.ts')
  })
})
