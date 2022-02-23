ugdu is a collection of tools for developing micro front-end projects.

## Features

- Minimal build time.
  - For your source code, only files changed will be rebuilt.
  - For `vendor package`, only packages with version changes will be rebuilt.
- Minimal generated files.
  - Only modules imported by multiple modules or `local module` will be built separately.
- Minimal generated size.
  - For `vendor package`, only code used in your source code will be built into the generated files.
- Security.
  - The package will be rebuilt when you import `binding`s that the corresponding generated module haven't export in your source code.
  - We will throw a meaningful error in build time other than runtime when you accidentally make a mistake.
- Multiple framework in one project.
  - This means that you can upgrade or refactor your project incrementally. For example, develop new feature with vue3 and the other code remain vue2.

## Usage

### Install

#### Install pnpm

ugdu is based on [pnpm](https://pnpm.io/).

```
npm install -g pnpm
```

#### Install ugdu

```
pnpm add @ugdu/processor @ugdu/packer -DW
```

### Recommend project structure

```
// Your `local package`s
- packages
  // The entry package of app. You may need multiple entry package if your project has more than one app.
  - container
  - components
  - utils
  // Other business packages
// Assets in this directory will be served at root path / during dev, and copied to the root of the dist directory as-is.
- public
// Build scripts
- scripts
// The info that will be used in runtime such as `importmap` and `ur.modules` will be injected to `index.html` automatically.
// We can consider it as our template.
// Note: Different with vue, we don't seem `index.html` as entry point. So we don't need to add corresponding script tag to references our source code.
- index.html
- package.json
// The pnpm workspace config file
- pnpm-workspace.yaml
```

### Our index.html

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" href="/favicon.ico" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ugdu</title>
    <!-- Below script is our runtime helper -->
    <script async src="https://unpkg.com/@ugdu/runtime/dist/index.js"></script>
  </head>
  <body>
    <div id="app"></div>
  </body>
</html>
```

### Create and run task

```js
/**
 * @ugdu/packer is powered by vite. So we can use vite plugin.
 */
import vue from '@vitejs/plugin-vue'
import { Processor } from '@ugdu/processor'
/**
 * Here, `serve` and `build` are `task options` which is used to create `task`.
 * `serve` is used to start a dev server.
 * `build` is used to build for production.
 */
import { serve, build } from '@ugdu/packer'

const task = new Processor().task(build)

task.hook(
  'get-config',
  // The return value of this function will be seemed as config. For more information, please check our API documentation.
  () => {
    return {
      extensions: ['vue', 'ts', 'js'],
      apps: [
        {
          name: '@xx/container',
          packages (lps) {
            return lps.map((lp) => lp.name)
          }
        }
      ],
      routes: {
        container: {
          patterns: 'packages/*/src/pages/**/*.vue',
          base: '/',
          depth: 0
        }
      },
      meta: 'local',
      vite: {
        plugins: [vue()]
      }
    }
  }
)

task.run()
```
