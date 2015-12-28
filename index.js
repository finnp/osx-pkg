var zlib = require('zlib')
var fs = require('fs')
var cpiofs = require('cpio-fs')
var cpio = require('cpio-stream')
var mkbom = require('mkbom')
var xar = require('xar')
var pump = require('pump')
var debug = require('debug')('osx-pkg')
var duplexify = require('duplexify')
var parallel = require('run-parallel')

var payloadTemplate =
  '<pkg-info format-version="2" identifier="{{identifier}}" version="1.3.0" install-location="/" relocatable="true" auth="root">' +
  '\n  <payload installKBytes="{{installKBytes}}" numberOfFiles="{{numberOfFiles}}"/>' +
  '\n</pkg-info>'

module.exports = pack

function pack (dir, opts) {
  var output = duplexify()

  var pack = cpiofs.pack(dir, { map: function (header) {
    header.uid = 0
    header.gid = 80
    return header
  }})

  var totalSize = 0
  var numFiles = 0

  parallel([
    function (cb) {
      fs.mkdir(opts.tmpDir + '/base.pkg', cb)
    },
    function (cb) {
      fs.mkdir(opts.tmpDir + '/Resources', cb)
    }
  ], createPayload)

  function createPayload () {
    parallel([
      function (cb) {
        pump(
          pack,
          zlib.createGzip(),
          fs.createWriteStream(opts.tmpDir + '/base.pkg/Payload'),
          cb
        )
      },
      function (cb) {
        // count files and sizes by extracting the packed archive...
        var extract = cpio.extract()
        extract.on('entry', function (header, stream, cb) {
          totalSize += header.size
          numFiles++
          stream.on('end', function () {
            cb()
          })
          stream.resume()
        })

        pump(
          pack,
          extract,
          cb
        )
      }
    ], createPackageInfo)
  }

  function createPackageInfo (err) {
    if (err) return output.destroy(err)
    debug('Create PackageInfo', numFiles, 'files', totalSize, 'bytes')
    var packageInfo = payloadTemplate
      .replace('{{identifier}}', opts.identifier)
      .replace('{{installKBytes}}', Math.ceil(totalSize / 1000))
      .replace('{{numberOfFiles}}', numFiles)
    fs.writeFile(opts.tmpDir + '/base.pkg/PackageInfo', packageInfo, createBOMFile)
  }

  function createBOMFile () {
  // ~ $ mkbom -u 0 -g 80 root tmp/base.pkg/Bom
    debug('Create BOMFile...')
    pump(
      mkbom('./build/root', {uid: 0, gid: 80}),
      fs.createWriteStream(opts.tmpDir + '/base.pkg/Bom'),
      createDistributionFile
    )
  }

  function createDistributionFile () {
    debug('Create Distribution file...')
    fs.readFile(__dirname + '/Distribution', function (err, distributionTemplate) {
      if (err) throw err
      var distribution = distributionTemplate.toString()
        .replace(new RegExp('{{identifier}}', 'g'), opts.identifier)
        .replace('{{title}}', opts.title)
        .replace('{{installKBytes}}', Math.ceil(totalSize / 1000))
      fs.writeFile(opts.tmpDir + '/Distribution', distribution, function () {
        createXar()
      })
    })
  }

  function createXar () {
  // ~ $ ( cd tmp && xar --compression none -cf "../SimCow 1.3 Installer.pkg" * )
    debug('Pack xar...')
    output.setReadable(xar.pack([opts.tmpDir + '/base.pkg', opts.tmpDir + '/Resources', opts.tmpDir + '/Distribution'], {compression: 'none'}))
  }

  return output
}
