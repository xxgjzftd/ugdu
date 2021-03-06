<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@ugdu/packer](./packer.md) &gt; [PkgNode](./packer.pkgnode.md)

## PkgNode interface


<b>Signature:</b>

```typescript
export interface PkgNode 
```

## Properties

|  Property | Type | Description |
|  --- | --- | --- |
|  [ap](./packer.pkgnode.ap.md) | string | The absolute path of the folder for this package. |
|  [dependencies](./packer.pkgnode.dependencies.md) | [PkgNode](./packer.pkgnode.md)<!-- -->\[\] | This package's dependencies. |
|  [dependents](./packer.pkgnode.dependents.md) | [PkgNode](./packer.pkgnode.md)<!-- -->\[\] | Packages which depend on this package. |
|  [local](./packer.pkgnode.local.md) | boolean | Is this package a <code>local package</code>. |
|  [main?](./packer.pkgnode.main.md) | string | <i>(Optional)</i> The <code>main</code> field of this package. |
|  [name](./packer.pkgnode.name.md) | string |  |
|  [path](./packer.pkgnode.path.md) | string | The <code>path</code> of the folder for this package. Check [UserConfig.cwd](./packer.userconfig.cwd.md) for what <code>path</code> is. |
|  [version](./packer.pkgnode.version.md) | string |  |

