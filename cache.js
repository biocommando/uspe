const fs = require('fs')
const crypto = require('crypto')

let cache

const calculateHash = str => {
    const shasum = crypto.createHash('sha256')
    shasum.update(str)
    return shasum.digest('hex')
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

const isDirty = (outputFilename, fileContents, signature) => {
    const hash = calculateHash(fileContents)
    const cached = getCache()[outputFilename]
    const dirty = !(cached && cached.signature === signature && cached.hash === hash)
    cache[outputFilename] = {hash, signature}
    return dirty
}

const saveCache = () => {
    fs.writeFileSync('.cache', JSON.stringify(getCache()))
}

module.exports = {isDirty, saveCache}

