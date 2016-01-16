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
var distribution = require('./distribution.js')

var pkgInfoTemplate =
  '<pkg-info title="{{title}}" format-version="2" identifier="{{identifier}}" version="{{version}}" install-location="{{installLocation}}" relocatable="true" auth="root">' +
  '\n  <payload installKBytes="{{installKBytes}}" numberOfFiles="{{numberOfFiles}}"/>' +
  '\n</pkg-info>'

function noop () {}

module.exports = osxpkg
module.exports.addComponent = addComponent
module.exports.addDistribution = distribution
module.exports.pack = pack

function osxpkg (opts) {
  var output = duplexify()

  if (!opts.tmpDir) {
    var tmpName = crypto.randomBytes(16).toString('hex')
    opts.tmpDir = path.resolve(path.join(os.tmpDir(), tmpName))
    fs.mkdir(opts.tmpDir, function (err) {
      if (err) output.destroy('error', err)
      output.on('end', function () { rimraf(opts.tmpDir, noop) })
      output.on('error', function () { rimraf(opts.tmpDir, noop) })
      startPacking()
    })
  } else {
    startPacking()
  }

  function startPacking () {
    addComponent(opts.dir, opts.tmpDir, opts, function (err, cb) {
      if (err) return output.destroy(err)
      distribution(opts.tmpDir, function (err) {
        if (err) output.destroy('error', err)
        output.setReadable(pack(opts.tmpDir))
      })
    })
  }

  return output
}

function addComponent (inDir, outDir, opts, cb) {
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
        fs.mkdir(outDir + '/' + opts.identifier, cb)
      }
    ], createPayload)
  }

  function createPayload () {
    debug('create payload (cpio)')
    parallel([
      function (cb) {
        pump(
          pack,
          zlib.createGzip(),
          fs.createWriteStream(outDir + '/' + opts.identifier + '/Payload'),
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
      .replace('{{version}}', opts.version || '0.0.1')
      .replace('{{title}}', opts.title || opts.identifier)
      .replace('{{installKBytes}}', Math.ceil(totalSize / 1000))
      .replace('{{numberOfFiles}}', numFiles)
      .replace('{{installLocation}}', installLocation)
    fs.writeFile(outDir + '/' + opts.identifier + '/PackageInfo', packageInfo, createBOMFile)
  }

  function createBOMFile () {
    debug('Create BOMFile...')
    pump(
      mkbom(dir, {uid: 0, gid: 80}),
      fs.createWriteStream(outDir + '/' + opts.identifier + '/Bom'),
      cb
    )
  }
}

function pack (dir, cb) {
  debug('pack xar')
  var output = duplexify()
  fs.readdir(dir, function (err, files) {
    if (err) return output.destroy(err)
    files = files.map(function (file) {
      return path.join(dir, file)
    })
    output.setReadable(xar.pack(files, {compression: 'none'}))
  })
  return output
}
