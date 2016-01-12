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
var path = require('path')
var crypto = require('crypto')
var os = require('os')
var rimraf = require('rimraf')

var pkgInfoTemplate =
  '<pkg-info format-version="2" identifier="{{identifier}}" version="1.3.0" install-location="{{installLocation}}" relocatable="true" auth="root">' +
  '\n  <payload installKBytes="{{installKBytes}}" numberOfFiles="{{numberOfFiles}}"/>' +
  '\n</pkg-info>'

// https://developer.apple.com/library/mac/documentation/DeveloperTools/Reference/DistributionDefinitionRef/Chapters/Distribution_XML_Ref.html
var distributionTemplate =
  '<?xml version="1.0" encoding="utf-8"?>' +
  '\n<installer-script minSpecVersion="1.000000">' +
  '\n    <title>{{title}}</title>' +
  '\n    <options customize="allow" allow-external-scripts="no"/>' +
  '\n    <domains enable_anywhere="true"/>' +
  '\n    <choices-outline>' +
  '\n        <line choice="choice1"/>' +
  '\n    </choices-outline>' +
  '\n    <choice id="choice1" title="{{title}}">' +
  '\n        <pkg-ref id="{{identifier}}"/>' +
  '\n    </choice>' +
  '\n    <pkg-ref id="{{identifier}}" installKBytes="{{installKBytes}}" version="1.3.0" auth="Root">#base.pkg</pkg-ref>' +
  '\n</installer-script>'

function noop () {}

module.exports = pack
module.exports.packDir = packDir

function pack (opts) {
  var output = duplexify()

  if (!opts.tmpDir) {
    var tmpName = crypto.randomBytes(16).toString('hex')
    opts.tmpDir = path.resolve(path.join(os.tmpDir(), tmpName))
    fs.mkdir(opts.tmpDir, function (err) {
      if (err) output.destroy('error', err)
      output.on('end', function () { rimraf(opts.tmpDir, noop) })
      output.on('error', function () { rimraf(opts.tmpDir, noop) })
    })
  }

  packDir(opts.dir, opts.tmpDir, opts, function (err, cb) {
    if (err) return output.destroy(err)
    output.setReadable(xar.pack([opts.tmpDir + '/base.pkg', opts.tmpDir + '/Distribution'], {compression: 'none'}))
  })

  return output
}

function packDir (inDir, outDir, opts, cb) {
  var installLocation = opts.installLocation || '/'
  if (!inDir) {
    return cb(new Error('Missed specify the input dir'))
  }
  var dir = path.resolve(process.cwd(), inDir)

  var pack = cpiofs.pack(dir, { map: function (header) {
    header.uid = 0
    header.gid = 80
    return header
  }})

  var totalSize = 0
  var numFiles = 0

  createDirectories()

  function createDirectories () {
    parallel([
      function (cb) {
        fs.mkdir(outDir + '/base.pkg', cb)
      }
    ], createPayload)
  }

  function createPayload () {
    parallel([
      function (cb) {
        pump(
          pack,
          zlib.createGzip(),
          fs.createWriteStream(outDir + '/base.pkg/Payload'),
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
    if (err) return cb(err)
    debug('Create PackageInfo', numFiles, 'files', totalSize, 'bytes')
    var packageInfo = pkgInfoTemplate
      .replace('{{identifier}}', opts.identifier)
      .replace('{{installKBytes}}', Math.ceil(totalSize / 1000))
      .replace('{{numberOfFiles}}', numFiles)
      .replace('{{installLocation}}', installLocation)
    fs.writeFile(outDir + '/base.pkg/PackageInfo', packageInfo, createBOMFile)
  }

  function createBOMFile () {
    debug('Create BOMFile...')
    pump(
      mkbom(dir, {uid: 0, gid: 80}),
      fs.createWriteStream(outDir + '/base.pkg/Bom'),
      createDistributionFile
    )
  }

  function createDistributionFile () {
    debug('Create Distribution file...')
    var distribution = distributionTemplate
      .replace(new RegExp('{{identifier}}', 'g'), opts.identifier)
      .replace(new RegExp('{{title}}', 'g'), opts.title)
      .replace(new RegExp('{{installKBytes}}', 'g'), Math.ceil(totalSize / 1000))
    fs.writeFile(outDir + '/Distribution', distribution, function () {
      cb(null)
    })
  }
}
