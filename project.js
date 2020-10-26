let configFile = process.argv.find(x => x.match(/^config=.*\.json$/))
if (!configFile) throw 'Config file parameter required (config=<file.json>)'
configFile = configFile.split(/^config=/)[1]
const config = require('./'+configFile)

const fs = require('fs')
fs.writeFileSync('compile.bat', `node compile-playlist.js -i ${config.input} -o ${config.output}`)
fs.writeFileSync('clean.bat', `node clean.js ${configFile} %1`)
