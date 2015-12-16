var zlib = require('zlib')
var fs = require('fs')
var cpiofs = require('cpio-fs')
var cpio = require('cpio-stream')
var mkbom = require('mkbom')
var xar = require('xar')
var pump = require('pump')

var payloadTemplate =
  '<pkg-info format-version="2" identifier="{{identifier}}" version="1.3.0" install-location="/" relocatable="true" auth="root">' +
  '\n  <payload installKBytes="{{installKBytes}}" numberOfFiles="{{numberOfFiles}}"/>' +
  '\n</pkg-info>'

var opts = {
  identifier: 'org.nodejs.node.pkg',
  title: 'node'
}

// Create Payload
//  ~ $ ( cd root && find . | cpio -o --format odc --owner 0:80 | gzip -c ) > flat/base.pkg/Payload

console.log('Create payload...')

var pack = cpiofs.pack('./build/root', { map: function (header) {
  header.uid = 0
  header.gid = 80
  return header
}})

var todo = 2 // make sure both streams are finished
pump(
  pack,
  zlib.createGzip(),
  fs.createWriteStream('./build/flat/base.pkg/Payload'),
  function () {
    todo--
    if (todo === 0) createPackageInfo()
  }
)

// count files and sizes by extracting the packed archive...
var totalSize = 0
var numFiles = 0
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
  function () {
    todo--
    if (todo === 0) createPackageInfo()
  }
)

function createPackageInfo () {
  console.log('Create PackageInfo', numFiles, 'files', totalSize, 'bytes')
  var packageInfo = payloadTemplate
    .replace('{{identifier}}', opts.identifier)
    .replace('{{installKBytes}}', Math.ceil(totalSize / 1000))
    .replace('{{numberOfFiles}}', numFiles)
  fs.writeFile('./build/flat/base.pkg/PackageInfo', packageInfo, createBOMFile)
}

function createBOMFile () {
// ~ $ mkbom -u 0 -g 80 root flat/base.pkg/Bom
  console.log('Create BOMFile...')
  pump(
    mkbom('./build/root', {uid: 0, gid: 80}),
    fs.createWriteStream('./build/flat/base.pkg/Bom'),
    createDistributionFile
  )
}

function createDistributionFile () {
  console.log('Create Distribution file...')
  fs.readFile('Distribution', function (err, distributionTemplate) {
    if (err) throw err
    var distribution = distributionTemplate.toString()
      .replace(new RegExp('{{identifier}}', 'g'), opts.identifier)
      .replace('{{title}}', opts.title)
      .replace('{{installKBytes}}', Math.ceil(totalSize / 1000))
    fs.writeFile('./build/flat/Distribution', distribution, function () {
      createXar()
    })
  })
}

function createXar () {
// ~ $ ( cd flat && xar --compression none -cf "../SimCow 1.3 Installer.pkg" * )
  console.log('Pack xar...')
  pump(
    xar.pack(['build/flat/base.pkg', 'build/flat/Resources', 'build/flat/Distribution'], {compression: 'none'}),
    fs.createWriteStream('./build/Installer.pkg'),
    function () {
      console.log('DONE')
    }
  )
}
