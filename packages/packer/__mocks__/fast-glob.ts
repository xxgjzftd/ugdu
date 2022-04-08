import { lps, resolveLocalPkgPath, resolveSourcePath } from './utils'

export default jest.fn(
  (pattern: string | string[]) => {
    const fixed = '/src/pages/**/*'
    if (typeof pattern === 'string' && pattern.endsWith(fixed)) {
      const lpp = pattern.slice(0, -fixed.length)
      const lp = lps.find((lp) => resolveLocalPkgPath(lp.name) === lpp)
      return lp && lp.sources
        ? lp.sources.filter((s) => s.startsWith('src/pages/')).map((s) => resolveSourcePath(lp.name, s))
        : []
    } else {
      const all: string[] = []
      lps.forEach((lp) => lp.sources && all.push(...lp.sources.map((s) => resolveSourcePath(lp.name, s))))
      return Promise.resolve(all)
    }
  }
)
