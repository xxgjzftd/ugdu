<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@ugdu/runtime](./runtime.md) &gt; [Runtime](./runtime.runtime.md) &gt; [load](./runtime.runtime.load.md)

## Runtime.load() method

Loads the `module` corresponding to `mn`<!-- -->.

<b>Signature:</b>

```typescript
load(mn: string): Promise<any>;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  mn | string | The <code>module name</code> |

<b>Returns:</b>

Promise&lt;any&gt;

## Remarks

Here the `mn` means `module name`<!-- -->. The `module name` actually is [RuntimeModule.id](./runtime.runtimemodule.id.md)<!-- -->. When loading this `module`<!-- -->, for performance, the `module`<!-- -->s this `module` imports will be [preload](https://developer.mozilla.org/en-US/docs/Web/HTML/Link_types/preload)<!-- -->. To avoid [FOUC](https://en.wikipedia.org/wiki/Flash_of_unstyled_content)<!-- -->, the `module` will only be evaluated after the [RuntimeModule.css](./runtime.runtimemodule.css.md) is loaded.

