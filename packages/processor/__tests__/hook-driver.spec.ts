import { HookDriver } from '../src/hook-driver'

interface Result {
  prop: string
}

interface Hooks {
  hn0(): void
  hn1(arg: string): void
  hn2(arg0: number, arg1: string): void
  hn3(): Result
  hn4(arg: string): Result
  hn5(arg0: number, arg1: string): Result
}

describe('The hfs method', () => {
  const hd = new HookDriver<Hooks>(['hn0', 'hn1', 'hn2', 'hn3', 'hn4', 'hn5'])
  const fn00 = jest.fn()
  const fn01 = jest.fn()
  hd.hook('hn0', fn00)
  hd.hook('hn0', fn01)

  it('should return the corresponding hook fns', () => {
    expect(hd.hfs('hn0')).toEqual([fn00, fn01])
  })

  it('should return a empty array if there is no corresponding hook fns', () => {
    expect(hd.hfs('hn1')).toEqual([])
  })

  it('should throw error if there is no corresponding hook name', () => {
    // @ts-expect-error
    expect(() => hd.hfs('hn6')).toThrow()
  })
})

describe('The hook method', () => {
  const hd = new HookDriver<Hooks>(['hn0', 'hn1', 'hn2', 'hn3', 'hn4', 'hn5'])
  const fn00 = jest.fn()
  const fn01 = jest.fn()
  hd.hook('hn0', fn00)
  hd.hook('hn0', fn01)

  it('should be hooked into the hook driver sequentially', () => {
    //
    expect(hd.hfs('hn0')).toEqual([fn00, fn01])
  })
  it('should throw error if there is no corresponding hook name', () => {
    // @ts-expect-error
    expect(() => hd.hook('hn6')).toThrow()
  })
})

describe('The prepend method', () => {
  const hd = new HookDriver<Hooks>(['hn0', 'hn1', 'hn2', 'hn3', 'hn4', 'hn5'])
  const fn00 = jest.fn()
  const fn01 = jest.fn()
  hd.prepend('hn0', fn00)
  hd.prepend('hn0', fn01)

  it('should be hooked into the hook driver in reverse order', () => {
    expect(hd.hfs('hn0')).toEqual([fn01, fn00])
  })
  it('should throw error if there is no corresponding hook name', () => {
    // @ts-expect-error
    expect(() => hd.prepend('hn6')).toThrow()
  })
})
