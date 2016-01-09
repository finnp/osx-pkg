# osx-pkg
[![NPM](https://nodei.co/npm/osx-pkg.png)](https://nodei.co/npm/osx-pkg/)

Create OSX flat packages (.pkg) with pure JS.

```js
var createPackage = require('osx-pkg')
var fs = require('fs')

var opts = {
  identifier: 'org.nodejs.node.pkg',
  title: 'node'
}

createPackage('./root', opts)
 .pipe(fs.createWriteStream('Installer.pkg'))
```

The packaging is not done in a complete streaming fashion, but
a temporary folder will be used.
