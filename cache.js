const fs = require('fs')
const crypto = require('crypto')

let cache

const calculateHash = str => {
    const shasum = crypto.createHash('sha256')
    shasum.update(str)
    return shasum.digest('hex')
}

const calculateFileHash = file => {
    return calculateHash(fs.readFileSync(file).toString())
}

const getCache = () => {
    if (!cache) {
        if (fs.existsSync('.cache')) {
            cache = JSON.parse(fs.readFileSync('.cache').toString())
        } else {
            cache = {}
        }
    }
    return cache
}

const isDirty = (outputFilename, objects) => {
    const hash = calculateHash(objects.map(o => JSON.stringify(o)).join(';'))
    const cached = getCache()[outputFilename]
    const dirty = cached !== hash
    cache[outputFilename] = hash
    return dirty
}

const saveCache = () => {
    fs.writeFileSync('.cache', JSON.stringify(getCache()))
}

module.exports = {isDirty, saveCache, guid: '8fab1a46-73fc-4769-bd86-b330cfc63c98', calculateFileHash}

