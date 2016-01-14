var pack = require('./')
var pump = require('pump')
var fs = require('fs')

var opts = {
  identifier: 'org.playback.playback.pkg',
  title: 'Playback',
  installLocation: '/Applications',
  dir: __dirname + '/playback/'
  // tmpDir: __dirname + '/test/build/flat' // default to unique tmpDir
}

var testInstaller = __dirname + '/PlaybackInstaller.pkg'

pump(
  pack(opts),
  fs.createWriteStream(testInstaller),
  function (err) {
    if (err) throw err
  }
)
