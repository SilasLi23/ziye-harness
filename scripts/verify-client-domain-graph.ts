/**
 * Enforce intra-package domain layering inside `packages/client/*\/src/client/`.
 * verify-module-graph covers package-level edges; this gate covers the
 * directory level: domain directories may import `contract/` and never each
 * other, and only the assembly point (`apply.ts` / `index.ts`) may import
 * across domains.
 *
 * Layer model (lower may not import higher):
 *   0  contract/            shared contract API (types + slot declarations)
 *   1  <domain>/ + service  domain implementations (skeleton/, chat/, ...)
 *   2  apply.ts, index.ts   assembly point and re-export shell
 *
 * Run directly:
 *   pnpm exec tsx scripts/verify-client-domain-graph.ts
 */

import { globSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, posix, resolve, sep } from 'node:path'
import ts from 'typescript'

const root = resolve(import.meta.dirname, '..')
const CLIENT_DIR = join(root, 'packages/client')

/** Directory names treated as the shared contract layer (importable by all). */
const CONTRACT_DIRS = new Set(['contract'])
/** Top-level client files allowed to import across domains (assembly layer). */
const ASSEMBLY_FILES = new Set(['apply.ts', 'index.ts', 'index.tsx'])

interface Violation { file: string; imported: string; reason: string }

/** Recursively list .ts/.tsx files under dir (relative paths). */
function listSources(dir: string): string[] {
  return globSync('**/*.{ts,tsx}', { cwd: dir })
    .map(rel => rel.split(sep).join('/'))
    .filter(rel => !/\.legacy\./.test(rel.slice(rel.lastIndexOf('/') + 1)))
    .sort()
}

/** First path segment of a client-relative file, or '' for top-level files. */
function domainOf(rel: string): string {
  const ix = rel.indexOf('/')
  return ix === -1 ? '' : rel.slice(0, ix)
}

/**
 * Resolve one relative import to a client-directory-relative path.
 * @param file - Importing file relative to `src/client`.
 * @param specifier - Relative module specifier from that file.
 * @returns Normalized path, preserving leading `..` segments outside `src/client`.
 */
export function resolveClientImport(file: string, specifier: string): string {
  return posix.normalize(posix.join(posix.dirname(file), specifier))
}

function checkPackage(pkgName: string, clientDir: string, files: readonly string[]): Violation[] {
  const violations: Violation[] = []
  for (const rel of files) {
    const fromDomain = domainOf(rel)
    const isAssembly = fromDomain === '' && ASSEMBLY_FILES.has(rel)
    if (isAssembly) continue
    const source = readFileSync(join(clientDir, rel), 'utf8')
    const imports = ts.preProcessFile(source, true, true).importedFiles.toSorted((left, right) => left.pos - right.pos)
    for (const { fileName: spec } of imports) {
      if (!spec.startsWith('.')) continue
      const target = resolveClientImport(rel, spec)
      if (target === '..' || target.startsWith('../')) continue // package-level rules govern
      // Shared image/font files export resource URLs, not a business domain's code or CSS API.
      const sharedResource = target.startsWith('assets/')
        && /\.(?:svg|png|jpe?g|webp|avif|gif|woff2?|ttf|otf)$/i.test(target.replace(/[?#].*$/, ''))
      if (sharedResource) continue
      const toDomain = domainOf(target)
      if (toDomain === '' || CONTRACT_DIRS.has(toDomain)) continue // top-level shared file or contract layer
      if (fromDomain === toDomain) continue // inside one domain
      violations.push({
        file: `${pkgName}/src/client/${rel}`,
        imported: spec,
        reason: fromDomain === ''
          ? `top-level non-assembly file imports domain "${toDomain}" (only apply/index may assemble)`
          : `domain "${fromDomain}" imports sibling domain "${toDomain}" (route shared API through contract/)`,
      })
    }
  }
  return violations
}

/**
 * Inspect every Client source package under one workspace's Client group.
 * @param clientRoot - Absolute packages/client directory or an isolated fixture group.
 * @returns Domain-layering findings with repository-relative consumer paths.
 * @throws When the source corpus is empty instead of accepting a missing checkout.
 */
export function scanClientDomains(clientRoot: string): Violation[] {
  const violations: Violation[] = []
  let sourceFiles = 0
  for (const pkg of readdirSync(clientRoot)) {
    const clientDir = join(clientRoot, pkg, 'src/client')
    try {
      if (!statSync(clientDir).isDirectory()) continue
    } catch {
      // No client half in this package — nothing to layer-check.
      continue
    }
    const files = listSources(clientDir)
    sourceFiles += files.length
    violations.push(...checkPackage(pkg, clientDir, files))
  }
  if (sourceFiles === 0) throw new Error(`verify-client-domain-graph: no Client source files found under ${clientRoot}`)
  return violations
}

function main(): void {
  const violations = scanClientDomains(CLIENT_DIR)
  if (violations.length > 0) {
    console.error(`verify-client-domain-graph: ${violations.length} violation(s):`)
    for (const v of violations) console.error(`  ${v.file} -> ${v.imported}\n    ${v.reason}`)
    process.exitCode = 1
    return
  }
  console.log('verify-client-domain-graph: client domain layering clean.')
}

if (import.meta.filename === resolve(process.argv[1] ?? '')) main()
