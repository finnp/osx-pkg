# osx-pkg
[![NPM](https://nodei.co/npm/osx-pkg.png)](https://nodei.co/npm/osx-pkg/)

Create OSX flat packages (.pkg) with pure JS.

## example

```js
var osxpkg = require('osx-pkg')
var fs = require('fs')

var opts = {
  dir: './root' // the contents of this dir will be installed in installLocation
  installLocation: '/Applications'
  identifier: 'org.myorg.myapp.pkg',
  title: 'MyApp',
  version: '1.0.0'
}

osxpkg(opts)
 .pipe(fs.createWriteStream('Installer.pkg'))
```

The packaging is not done in a complete streaming fashion, but
a temporary folder will be used.

## example with multiple components

```js 
var osxpkg = require('osx-pkg')
var fs = require('fs')

var pkgDir = './out'

fs.mkdirSync(pkgDir)

osxpkg.addComponent(pkgDir, './build/CoolApp.app', {...}, function (err) {
  if (err) return console.error(err)
  osxpkg.addComponent(pkgDir, './build/CoolAppCompanion.app', {...}, function (err) {
    if (err) return console.error(err)
    osxpkg.addDistribution(pkgDir, function (err) {
      if (err) return console.error(err)
      oskpkg.pack(pkgDir).pipe(fs.createWriteStream('Installer.pkg'))
    })
    console.log('DONE')
  })
})


```

## API

## `osxpkg(opts)`

Returns a readable stream that you can read the finished Installer from.


### Options
- `dir` Path to a directory whose contents are going to be installed in installLocation
- `identifier` Identifier for your package, e.g. `org.myorg.myapp.pkg`
- `title` The Title of your package

- `installLocation` (defaults to `/`)
- `tmpDir` The unpackaged pkg will be created here (defaults to a newly created directory in the tmp dir)


## `osxpkg.addComponent(inDir, outDir, opts, cb)`

The final `.pkg` is just a `xar` archived directory with the following structure:
```
Installer.pkg
- Distribution
- component1.pkg
  - Bom
  - Payload
  - PackageInfo
- component2.pkg
  - Bom
  - Payload
  - PackageInfo
- Resources (optional)
```

These components are actually called packages as well. But I am calling them
components to not confuse them with the resulting package...

Given an `inDir` and an `outDir`, this function will package the contents of `inDir`
as a component and add it to `outDir`. So it allows to add multiple components
to an installer before creating the `Distribution` file and finalizing it with `xar`.


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
Here are 3 modules that are essential for creating an OSX flat package.

### [cpio-fs](http://npm.im/cpio-fs)

Pack the Payload in the cpio format.

### [mkbom](http://npm.im/mkbom)

Create the Bill of Materials files for the contents

### [xar](http://npm.im/xar)

Flatten the package with xar.
