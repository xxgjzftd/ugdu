<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@ugdu/packer](./packer.md) &gt; [UserAppConfig](./packer.userappconfig.md)

## UserAppConfig interface

<b>Signature:</b>

```typescript
export interface UserAppConfig 
```

## Remarks

The `app` can actually be thought of as the entry `package`<!-- -->.

## Properties

|  Property | Type | Description |
|  --- | --- | --- |
|  [name](./packer.userappconfig.name.md) | string | The name of <code>local package</code> which is the entry package of this app. |
|  [packages](./packer.userappconfig.packages.md) | ((packages: [PkgNode](./packer.pkgnode.md)<!-- -->\[\]) =&gt; string\[\]) \| string\[\] | The packages belonging to this <code>app</code>. |
|  [predicate?](./packer.userappconfig.predicate.md) | (pathname: string) =&gt; boolean | <i>(Optional)</i> Whether to load and mount this <code>app</code>. |
|  [vite?](./packer.userappconfig.vite.md) | InlineConfig | <i>(Optional)</i> The vite config which will be applied when building this <code>app</code>. |

