<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@ugdu/packer](./packer.md) &gt; [Project](./packer.project.md)

## Project interface

The information of your project.

<b>Signature:</b>

```typescript
export interface Project 
```

## Properties

|  Property | Type | Description |
|  --- | --- | --- |
|  [alias](./packer.project.alias.md) | AliasOptions | The alias config used when building. |
|  [meta](./packer.project.meta.md) | { pre: [Meta](./packer.meta.md)<!-- -->; cur: [Meta](./packer.meta.md)<!-- -->; } | The information of the building. |
|  [pkgs](./packer.project.pkgs.md) | [PkgNode](./packer.pkgnode.md)<!-- -->\[\] | All <code>package</code>s including <code>local package</code>s and <code>vendor package</code>s in your project. |
|  [routes](./packer.project.routes.md) | [Routes](./packer.routes.md) | A <code>routes module</code> name to <code>routes module</code> information map. |
|  [sources](./packer.project.sources.md) | [Sources](./packer.sources.md) | The information of your source files. |
