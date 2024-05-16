# @ugdu/packer

## 2.0.1

### Patch Changes

- 45b976d: @ugdu/packer: Fix the bug in the serve task during development where the routing module does not have hot reloading.
- Updated dependencies [45b976d]
  - @ugdu/processor@2.0.1

## 2.0.0

### Major Changes

- 618358e: Update the major package version to the latest
  Replace jest with vitest for a better test experience
  Fix some bugs

### Patch Changes

- Updated dependencies [618358e]
  - @ugdu/processor@2.0.0

## 1.0.6

### Patch Changes

- 14b1ed6: Fix the bug that the build process throw an error accidently when a module `a` import `something` from a module `b` in previous build and in current build `b` no longer export `something` and `a` doesn't import it too.

## 1.0.5

### Patch Changes

- c815ad1: print dev server info

## 1.0.4

### Patch Changes

- 15a252c: Fix update id error when copy build info.

## 1.0.3

### Patch Changes

- db6a113: Fix the bug that the build process throw an error accidently when there are vendor packages upgrade.

## 1.0.2

### Patch Changes

- 5f0578d: The build process should not be interrupted when there are changes to files that are not in the `project.sources.all`.

## 1.0.1

### Patch Changes

- 7675656: The `write` task should be executed after the `buildEntry` task finished.

## 1.0.0

### Major Changes

- a0629cd: initial release

### Patch Changes

- Updated dependencies [a0629cd]
  - @ugdu/processor@1.0.0
