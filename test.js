var pack = require('./')
var pump = require('pump')
var fs = require('fs')

var opts = {
  identifier: 'org.nodejs.node.pkg',
  title: 'node',
  tmpDir: './build/flat' // default to unique tmpDir
}

pump(
  pack('./build/root', opts),
  fs.createWriteStream('Installer.pkg')
)
