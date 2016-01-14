var fs = require('fs')
var path = require('path')
var xmlParse = require('xml2js').parseString
var xml = require('xml')
var parallel = require('run-parallel')

module.exports = createDistributionFile

function createDistributionFile (cwd, cb) {
  getDistribution(cwd, function (err, contents) {
    if (err) return cb(err)
    fs.writeFile(path.join(cwd, 'Distribution'), contents, cb)
  })
}

function getDistribution (cwd, cb) {
  fs.readdir(cwd, function (err, files) {
    if (err) return cb(err)
    var getXml = files
    .filter(function (file) {
      return file.slice(-4) === '.pkg'
    })
    .map(function (dir) {
      return function (cb) {
        fs.readFile(path.join(cwd, dir, 'PackageInfo'), 'utf8', function (err, content) {
          if (err) return cb(err)
          xmlParse(content, function (err, result) {
            if (err) return cb(err)
            result.dir = dir
            cb(null, result)
          })
        })
      }
    })
    parallel(getXml, function (err, pkgInfos) {
      if (err) cb(err)
      var pkgs = pkgInfos.map(function (pkg) {
        var pkgInfo = pkg['pkg-info']
        return {
          dir: pkg.dir,
          installKBytes: Number(pkgInfo.payload[0].$.installKBytes),
          identifier: pkgInfo.$.identifier,
          version: pkgInfo.$.version || 0,
          title: pkgInfo.$.title || pkgInfo.$.identifier
        }
      })
      cb(null, createDistributionXml({}, pkgs))
    })
  })
}

// https://developer.apple.com/library/mac/documentation/DeveloperTools/Reference/DistributionDefinitionRef/Chapters/Distribution_XML_Ref.html
function createDistributionXml (opts, pkgs) {
  var title = opts.title || pkgs.map(function (pkg) {
    return pkg.title
  }).join(' / ')
  var distribution = {
    'installer-script': [
      {_attr: {minSpecVersion: '1.000000'}},
      {title: title},
      {options: {_attr: {customize: 'allow', 'allow-external-scripts': 'no'}}},
      {domains: {_attr: {enable_anywhere: 'true'}}},
      {'choices-outline': pkgs.map(function (pkg) {
        return {'line': {_attr: {'choice': pkg.dir}}}
      })}
    ]
  }

  pkgs.forEach(function (pkg) {
    distribution['installer-script'].push({choice: [
      {_attr: {id: pkg.dir, title: pkg.title}},
      {'pkg-ref': [
        {_attr: {id: pkg.identifier, installKBytes: pkg.installKBytes, version: pkg.version, auth: 'Root'}},
        '#' + pkg.dir
      ]}
    ]})
  })

  return xml(distribution, {declaration: true, indent: '    '})
}
