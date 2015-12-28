var pack = require('./')
var pump = require('pump')
var fs = require('fs')

var opts = {
  identifier: 'org.nodejs.node.pkg',
  title: 'node',
  installLocation: __dirname,
  tmpDir: __dirname + '/test/build/flat' // default to unique tmpDir
}

var testInstaller = __dirname + '/Installer.pkg'

pump(
  pack(__dirname + '/test/build/root', opts),
  fs.createWriteStream(testInstaller)
)
