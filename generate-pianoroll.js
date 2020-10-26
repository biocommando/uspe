const range = process.argv.find(x => x.match(/^range=[^-]+-[^-]+$/))
const length = process.argv.find(x => x.match(/^length=\d+$/))
if (!range || !length) {
    throw 'Parameters required: range=<note1>-<note2> length=<bars>'
}

const fs = require('fs')
const { translateNote, numToNote } = require('./lib/translate-note')

const [n1, n2] = range.split('=')[1].split('-').map(translateNote)

const bars = Number(length.split('=')[1])

console.log(`length = ${bars} bars`)

for (let n = n2; n >= n1; n--) {
    let noteStr = numToNote(n)
    noteStr = ' '.repeat(5 - noteStr.length) + noteStr + ' '
    console.log('@' + noteStr + '|....'.repeat(bars) + '|')
}