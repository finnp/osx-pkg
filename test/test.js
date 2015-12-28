var pack = require('../')
var pump = require('pump')
var fs = require('fs')
var xar = require('xar')
var test = require('tape')

var opts = {
  identifier: 'org.nodejs.node.pkg',
  title: 'node',
  tmpDir: __dirname + '/build/flat' // default to unique tmpDir
}

var testInstaller = __dirname + '/TestInstaller.pkg'

test('create installer and inspect packed pkg', function (t) {
  t.plan(6)
  pump(
    pack(__dirname + '/build/root', opts),
    fs.createWriteStream(testInstaller),
    function (err) {
      if (err) throw err
      xar.unpack(fs.readFileSync(testInstaller), function (err, file, content) {
        if (err) throw err
        t.pass(file.path)
      })
    }
  )
})
