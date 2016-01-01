var pack = require('./')
var pump = require('pump')
var fs = require('fs')

var opts = {
  identifier: 'org.playback.playback.pkg',
  title: 'Playback',
  installLocation: '/Applications',
  tmpDir: __dirname + '/test/build/flat' // default to unique tmpDir
}

var testInstaller = __dirname + '/PlaybackInstaller.pkg'

pump(
  pack(__dirname + '/playback/', opts),
  fs.createWriteStream(testInstaller),
  function (err) {
    if (err) throw err
  }
)
