A runtime lib for micro frontends.

## Overview

This runtime lib provide a `ur` global variable which has some helpful methods like `register`, `load`, `unload` and `start`.
For features, check [features](#features).
For a simple example, check [usage](#usage).
The phrases like `app` are terms. Their brief explanation is [here](#terms).
For more detail, check our [API docs](https://github.com/xxgjzftd/ugdu/blob/main/docs/runtime.md).

## Features

- Independent deployment.
  - All `module`s can be deployed independently.
- Multiple frameworks in one project.
  - Different `app`s can be based on different frameworks. This means that you can upgrade or refactor your project incrementally. For example, develop new feature with vue3 and the other code remain vue2.
- Style security.
  - To avoid [FOUC](https://en.wikipedia.org/wiki/Flash_of_unstyled_content), the `module` will only be evaluated after the css it required is loaded.
  - The css of the `app`s which should be unload will be removed from the document.
- Lazy load.
  - Only the `module`s which are used by the active `app`s will be loaded.
- Preload assets
  - When load a `module`, all `module`s this `module` imports will be [preload](https://developer.mozilla.org/en-US/docs/Web/HTML/Link_types/preload).

## Usage

Include `@ugdu/runtime` with a async attribute on the script, then include an importmap and module scripts normally.

Below is an example for a project that which registers two `app`, one based on vue2 and the other based on vue2.

Tips: When using our build tool `@ugdu/packer`, the importmap and the startup script will be generated according to your source code.

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" href="/favicon.ico" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ugdu</title>
    <script async src="https://unpkg.com/@ugdu/runtime/dist/index.js"></script>
    <script type="importmap-shim">
      {
        "imports": {
          "@v2/container": "/assets/@v2/container/index.js",
          "@v2/purchase/src/pages/list.vue": "/assets/@v2/purchase/list.js",
          "@v3/container": "/assets/@v3/container/index.js",
          "@v3/sale/src/pages/list.vue": "/assets/@v2/sale/list.js",
        },
        "scopes": {
          "/assets/@v2/container": {
            "vue": "https://unpkg.com/vue@2/dist/vue.esm.browser.js"
          },
          "/assets/@v2/purchase": {
            "vue": "https://unpkg.com/vue@2/dist/vue.esm.browser.js"
          },
          "/assets/@v3/container": {
            "vue": "https://unpkg.com/vue@3/dist/vue.esm-browser.js"
          },
          "/assets/@v3/sale": {
            "vue": "https://unpkg.com/vue@3/dist/vue.esm-browser.js"
          }
        }
      }
    </script>
    <script type="module-shim">
      ur.register('@v2/container', pathname => pathname.startsWith('/v2'), () => ur.load('@v2/container'))
      ur.register('@v3/container', pathname => pathname.startsWith('/v3'), () => ur.load('@v3/container'))
      const base = '/'
      const rms = [
        {
          id: '@v2/container',
          js: 'assets/@v2/container/index.js',
          css: 'assets/@v2/container/index.css',
          imports: ['vue@2']
        },
        {
          id: '@v2/purchase/src/pages/list.vue',
          js: 'assets/@v2/purchase/list.js',
          css: 'assets/@v2/purchase/list.css',
          imports: ['vue@2']
        },
        {
          id: '@v3/container',
          js: 'assets/@v3/container/index.js',
          css: 'assets/@v3/container/index.css',
          imports: ['vue@3']
        },
        {
          id: '@v3/sale/src/pages/list.vue',
          js: 'assets/@v3/sale/list.js',
          css: 'assets/@v3/sale/list.css',
          imports: ['vue@3']
        }
      ]
      ur.start(rms, base)
    </script>
  </head>
  <body>
    <div id="app"></div>
  </body>
</html>
```

## Terms

- `app`
  The `app` can actually be thought of as the entry `package`. We can register multiple `app` in one project. And those `app` could based on different framework.
- `module`
  The js `module`. The `module` may import other `module`s or css.