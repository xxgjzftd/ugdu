<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@ugdu/packer](./packer.md) &gt; [UserConfig](./packer.userconfig.md) &gt; [extensions](./packer.userconfig.extensions.md)

## UserConfig.extensions property

In `local package`<!-- -->s which don't have `main` field, all files with extension in this config are considered to be a `module`<!-- -->.

<b>Signature:</b>

```typescript
extensions: string[];
```

## Remarks

There are two types in our source files. One is `module`<!-- -->, the other is `source`<!-- -->. `source`<!-- -->s are bundled into `module` when building. `module`<!-- -->s import each other at runtime. In packages which have `main` field, the corresponding file of `main` is considered to be a `module`<!-- -->, and the other files are considered as `source`<!-- -->. In packages which don't have `main` field, all files with extension in this config are considered to be a `module`<!-- -->. Usually, this config will be `['js', 'ts', 'jsx', 'tsx']`<!-- -->. According to the framework you use, you should specify the corresponding value. Such as, for `vue`<!-- -->, you should add `vue` to this config. Check [MetaModule](./packer.metamodule.md) for more information about `module`<!-- -->.

