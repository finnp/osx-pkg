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

var payloadTemplate =
  '<pkg-info format-version="2" identifier="{{identifier}}" version="1.3.0" install-location="{{installLocation}}" relocatable="true" auth="root">' +
  '\n  <payload installKBytes="{{installKBytes}}" numberOfFiles="{{numberOfFiles}}"/>' +
  '\n</pkg-info>'

var distributionTemplate =
  '<?xml version="1.0" encoding="utf-8"?>' +
  '\n<installer-script minSpecVersion="1.000000" authoringTool="com.apple.PackageMaker" authoringToolVersion="3.0.3" authoringToolBuild="174">' +
  '\n    <title>{{title}}</title>' +
  '\n    <options customize="never" allow-external-scripts="no"/>' +
  '\n    <domains enable_anywhere="true"/>' +
  '\n    <choices-outline>' +
  '\n        <line choice="choice1"/>' +
  '\n    </choices-outline>' +
  '\n    <choice id="choice1" title="base">' +
  '\n        <pkg-ref id="{{identifier}}"/>' +
  '\n    </choice>' +
  '\n    <pkg-ref id="{{identifier}}" installKBytes="{{installKBytes}}" version="1.3.0" auth="Root">#base.pkg</pkg-ref>' +
  '\n</installer-script>'

function noop () {}

module.exports = pack

function pack (opts) {
  var installLocation = opts.installLocation || '/'
  var output = duplexify()
  if (!opts.dir) {
    process.nextTick(function () {
      output.emit('error', new Error('Missed specify the input dir'))
    })
    return output
  }
  var dir = path.resolve(process.cwd(), opts.dir)

  var pack = cpiofs.pack(dir, { map: function (header) {
    header.uid = 0
    header.gid = 80
    return header
  }})

  var totalSize = 0
  var numFiles = 0

  if (!opts.tmpDir) {
    var tmpName = crypto.randomBytes(16).toString('hex')
    opts.tmpDir = path.resolve(path.join(os.tmpDir(), tmpName))
    fs.mkdir(opts.tmpDir, function (err) {
      if (err) output.emit('error', err)
      output.on('end', function () { rimraf(opts.tmpDir, noop) })
      output.on('error', function () { rimraf(opts.tmpDir, noop) })
      createDirectories()
    })
  } else {
    createDirectories()
  }

  function createDirectories () {
    output.dir = opts.tmpDir
    parallel([
      function (cb) {
        fs.mkdir(opts.tmpDir + '/base.pkg', cb)
      },
      function (cb) {
        fs.mkdir(opts.tmpDir + '/Resources', cb)
      }
    ], createPayload)
  }

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
      .replace('{{installLocation}}', installLocation)
    fs.writeFile(opts.tmpDir + '/base.pkg/PackageInfo', packageInfo, createBOMFile)
  }

  function createBOMFile () {
    debug('Create BOMFile...')
    pump(
      mkbom(dir, {uid: 0, gid: 80}),
      fs.createWriteStream(opts.tmpDir + '/base.pkg/Bom'),
      createDistributionFile
    )
  }

  function createDistributionFile () {
    debug('Create Distribution file...')
    var distribution = distributionTemplate
      .replace(new RegExp('{{identifier}}', 'g'), opts.identifier)
      .replace('{{title}}', opts.title)
      .replace('{{installKBytes}}', Math.ceil(totalSize / 1000))
    fs.writeFile(opts.tmpDir + '/Distribution', distribution, function () {
      createXar()
    })
  }

  function createXar () {
    debug('Pack xar...')
    output.setReadable(xar.pack([opts.tmpDir + '/base.pkg', opts.tmpDir + '/Resources', opts.tmpDir + '/Distribution'], {compression: 'none'}))
  }

  return output
}
