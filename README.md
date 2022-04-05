`ugdu` is an intuitive micro frontends solution.

## Overview

`ugdu` is a collection of tools for developing micro frontends projects.
It includes a [task processor](https://github.com/xxgjzftd/ugdu/blob/main/packages/processor/README.md) which could be hooked in,
a [packer](https://github.com/xxgjzftd/ugdu/blob/main/packages/packer/README.md) powered by the task processor to help develop and build micro frontends projects,
and a [runtime lib](https://github.com/xxgjzftd/ugdu/blob/main/packages/runtime/README.md).
Check [here](https://github.com/xxgjzftd/ugdu/blob/main/packages/packer/README.md#Usage) for a quick start.
For more detail, check our [API docs](https://github.com/xxgjzftd/ugdu/blob/main/docs/index.md).

## Features

- When building
  - Minimal build time.
    - For your source code, only files changed will be rebuilt.
    - For `vendor package`, only packages whose version changes will be rebuilt.
  - Minimal generated files.
    - For `vendor package`, Only packages imported by multiple `module`s or `local module` will be built separately.
  - Minimal generated size.
    - For `vendor package`, only code used in your source code will be built into the generated files.
  - Security.
    - The package will be rebuilt when you import `binding`s that the corresponding generated module haven't export.
    - We will throw a meaningful error in build time other than runtime when you accidentally make a mistake.
  - Extensible
    - You can hook into the stage you are interested in when you develop an application.
    - You can enhance our built-in `task options`, or create your own. And then share to others.
- At runtime
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

In addition, all packages are well typed. So you will be prompted when using the API.

## License

[MIT](https://github.com/xxgjzftd/ugdu/blob/main/LICENSE)