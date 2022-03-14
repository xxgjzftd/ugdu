<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@ugdu/packer](./packer.md) &gt; [buildEntry](./packer.buildentry.md)

## buildEntry variable

Build the entry of the project.

<b>Signature:</b>

```typescript
buildEntry: TaskOptions<import("./config").SetConfigHooks & import("./project").SetProjectHooks, never>
```

## Remarks

It creates the `importmap` and startup script of [@ugdu/runtime](https://github.com/xxgjzftd/ugdu/blob/main/packages/runtime/README.md) according to the `module`<!-- -->s of this project. Then inject them to `index.html`<!-- -->.
