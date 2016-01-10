# osx-pkg
[![NPM](https://nodei.co/npm/osx-pkg.png)](https://nodei.co/npm/osx-pkg/)

Create OSX flat packages (.pkg) with pure JS.

```js
var createPackage = require('osx-pkg')
var fs = require('fs')

var opts = {
  dir: './root' // the contents of this dir will be installed in installLocation
  installLocation: '/Applications'
  identifier: 'org.myorg.myapp.pkg',
  title: 'MyApp'
}

createPackage(opts)
 .pipe(fs.createWriteStream('Installer.pkg'))
```

The packaging is not done in a complete streaming fashion, but
a temporary folder will be used.

## Options

- `dir` Path to a directory whose contents are going to be installed in installLocation
- `identifier` Identifier for your package, e.g. `org.myorg.myapp.pkg`
- `title` The Title of your package

- `installLocation` (defaults to `/`)
- `tmpDir` The unpackaged pkg will be created here (defaults to a newly created directory in the tmp dir)

## CLI

This modules ships with a CLI:

```
osx-pkg <inputdir>
Packages <inputdir> as an osx flat package to stdout
	options
	--identifier Identifier for your package
	--title Title of your package
	--location Install location (default "/")
  ```

## Modules

You can also create your pkg files by using the components of this modules.
Here's 3 modules that are essential to create an OSX flat package.

### [cpiofs](http://npm.im/cpiofs)

Pack the Payload in the cpio format.

### [mkbom](http://npm.im/mkbom)

Create the Bill of Materials files for the contents

### [xar](http://npm.im/xar)

Flatten the package with xar.
