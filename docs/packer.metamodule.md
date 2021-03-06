<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@ugdu/packer](./packer.md) &gt; [MetaModule](./packer.metamodule.md)

## MetaModule interface

The information of a `module`<!-- -->.

<b>Signature:</b>

```typescript
export interface MetaModule 
```

## Remarks

There are three types `module` in our project.

First is `local module`<!-- -->. `local module` comes from `local package`<!-- -->. For a `local package` which have `main` field, the corresponding file of `main` is a `local module`<!-- -->, and the other files will be bundled into this module. For other `local package`<!-- -->s, all files with extension in [UserConfig.extensions](./packer.userconfig.extensions.md) are considered to be a `local module`<!-- -->.

Second is `vendor module`<!-- -->. `vendor module` comes from `vendor package`<!-- -->. Only `vendor package`<!-- -->s imported by multiple `module`<!-- -->s or `local module` have a corresponding `vendor module`<!-- -->. The other `vendor package`<!-- -->s will be bundled into the `vendor module` which import them.

Last is `routes module`<!-- -->. `routes module` is generated according to the structure of your project.

## Properties

|  Property | Type | Description |
|  --- | --- | --- |
|  [css?](./packer.metamodule.css.md) | string | <i>(Optional)</i> The generated css file url. This field may not exist if this module doesn't have any css. |
|  [exports?](./packer.metamodule.exports.md) | string\[\] | <i>(Optional)</i> The exported variable names. Used to check if there is any error in the local modules build. Only local modules have this field. |
|  [externals?](./packer.metamodule.externals.md) | string\[\] | <i>(Optional)</i> All public package names this module may depends. A vendor module will not be rebuilt unless one of it's externals and exports changed. Only vendor modules have this field. |
|  [id](./packer.metamodule.id.md) | string | The module name. There are three types of module names. First is <code>local module</code> name. Such as <code>@pkg/components</code>, <code>@pkg/sale/src/pages/order/index.vue</code> Second is <code>routes module</code> name. Such as <code>routes/v2</code> Last is <code>vendor module</code> name. Such as <code>lodash@4.17.21</code> Here the <code>vendor module</code> name actually is versioned vendor package name. |
|  [imports](./packer.metamodule.imports.md) | [MetaModuleImport](./packer.metamoduleimport.md)<!-- -->\[\] | The import info of this module include from which package and import what. |
|  [js](./packer.metamodule.js.md) | string | The generated js file url. |
|  [sources?](./packer.metamodule.sources.md) | string\[\] | <i>(Optional)</i> The static resources this module depends. Such as css, img etc. Only local modules have this field when it does depend any static resources. |

