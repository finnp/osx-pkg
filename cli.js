#!/usr/bin/env node

var usage = 'osx-pkg <inputdir>\n' +
  'Packages <inputdir> as an osx flat package to stdout\n' +
  '\toptions\n' +
  '\t--identifier Identifier for your package\n' +
  '\t--title Title of your package\n' +
  '\t--location Install location (default "/")'

var pack = require('.')
var opts = require('minimist')(process.argv.slice(2))

if (!opts._[0]) {
  console.error(usage)
  process.exit(1)
}

opts.dir = opts._[0]
opts.installLocation = opts.location

pack(opts)
  .pipe(process.stdout)
