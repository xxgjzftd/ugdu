<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@ugdu/packer](./packer.md) &gt; [Utils](./packer.utils.md) &gt; [getPublicPkgNameFromDepPath](./packer.utils.getpublicpkgnamefromdeppath.md)

## Utils.getPublicPkgNameFromDepPath() method

Gets the `public package name` from dep path. The `public package name` is the package name used at runtime.

<b>Signature:</b>

```typescript
getPublicPkgNameFromDepPath(dp: PkgNode[]): string;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  dp | [PkgNode](./packer.pkgnode.md)<!-- -->\[\] | The dep path |

<b>Returns:</b>

string

The `public package name`

## Remarks

At runtime, we couldn't use the `package` name directly, because there may be another `package` has same name but different version. We couldn't use the versioned package name too, because we don't want rebuild and redeploy the `module`<!-- -->s when only their deps's version changed. So we use the `public package name` which descripe the dep path. For `package`<!-- -->s which has same name but different version, the dep path must be different. When a `package`<!-- -->'s version changed, the dep path from the `module`<!-- -->s which import it to the `package` will not change.

