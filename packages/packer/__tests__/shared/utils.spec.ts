import { cached, clone } from '../../src/shared/utils'

describe('cached', () => {
  it('should return a cached version function which will only be called once and return the same value for the same argument', () => {
    const fn = jest.fn((key: string) => ({ key }))
    const cachedFn = cached(fn)

    const foo = 'foo'
    const resFoo0 = cachedFn(foo)
    const resFoo1 = cachedFn(foo)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(resFoo0).toBe(resFoo1)

    const bar = 'bar'
    const resBar0 = cachedFn(bar)
    const resBar1 = cachedFn(bar)
    expect(fn).toHaveBeenCalledTimes(2)
    expect(resBar0).toBe(resBar1)
  })
})

describe('clone', () => {
  it('should deep clone a target', () => {
    const target = {
      foo: 'foo',
      bar: {
        baz: 'baz'
      }
    }
    const result = clone(target)
    expect(result).toEqual(target)
    expect(result).not.toBe(target)
    expect(result.bar).not.toBe(target.bar)
  })
})
