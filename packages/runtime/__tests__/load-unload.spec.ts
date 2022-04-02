import '../src/runtime'

// @ts-ignore
window.importShim = jest.fn()

const ur = window.ur
const base = '/'
const rms = [
  {
    id: '@v2/container',
    js: 'assets/@v2/container/index.js',
    css: 'assets/@v2/container/index.css',
    imports: ['vue@2.0.0', '@v2/purchase/src/pages/list.vue']
  },
  {
    id: '@v2/purchase/src/pages/list.vue',
    js: 'assets/@v2/purchase/list.js',
    css: 'assets/@v2/purchase/list.css',
    imports: ['vue@2.0.0']
  },
  {
    id: 'vue@2.0.0',
    js: 'assets/vue@2.0.0/index.js',
    imports: []
  }
]

it('should preload the js and the css of the module and its deps recursively', async () => {
  // We havn't registered any apps, so the start method does nothing but set `ur.modules` and `ur.base`.
  await ur.start(rms, base)
  await ur.load('@v2/container')
  expect(document.querySelector('link[href="/assets/@v2/container/index.js"]')).toBeTruthy()
  expect(document.querySelector('link[href="/assets/@v2/container/index.css"]')).toBeTruthy()
  expect(document.querySelector('link[href="/assets/@v2/purchase/list.js"]')).toBeTruthy()
  expect(document.querySelector('link[href="/assets/@v2/purchase/list.css"]')).toBeTruthy()
  expect(document.querySelector('link[href="/assets/vue@2.0.0/index.js"]')).toBeTruthy()
  // @ts-ignore
  expect(window.importShim).toHaveBeenCalledWith('@v2/container')
})

it('should unload the css of the module and its deps recursively', async () => {
  await ur.unload('@v2/container')
  expect(document.querySelector('link[href="/assets/@v2/container/index.css"]')).toBeFalsy()
  expect(document.querySelector('link[href="/assets/@v2/purchase/list.css"]')).toBeFalsy()
})
