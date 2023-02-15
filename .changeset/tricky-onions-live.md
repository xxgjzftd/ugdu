---
'@ugdu/packer': patch
---

Fix the bug that the build process throw an error accidently when a module `a` import `something` from a module `b` in previous build and in current build `b` no longer export `something` and `a` doesn't import it too.
