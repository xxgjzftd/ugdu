import { defineProject } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineProject(
  {
    define: { TEST: true },
    plugins: [tsconfigPaths()],
    test: { environment: 'jsdom' }
  }
)
