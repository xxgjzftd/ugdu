import { vi } from 'vitest'

vi.mock('@pnpm/find-workspace-packages')
vi.mock('@pnpm/reviewing.dependencies-hierarchy')
vi.mock('fs/promises')
vi.mock('axios')
vi.mock('execa')
vi.mock('fast-glob')

vi.mock(
  'vite',
  async () => {
    return {
      ...(await vi.importActual('vite')),
      build: vi.fn(),
      createServer: vi.fn()
    }
  }
)
