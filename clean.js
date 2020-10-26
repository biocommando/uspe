const fs = require('fs')
const config = require('./' + process.argv[2])
if (!process.argv[3]) {
    fs.unlinkSync('.cache')
    return
}
let sampledir = ''
if (config.sampledir) sampledir = config.sampledir

const cache = JSON.parse(fs.readFileSync('.cache').toString())
delete cache[sampledir + process.argv[3]]
fs.writeFileSync('.cache', JSON.stringify(cache))