const fs = require('fs')

const _16bitIntToFloat = 1 / 32767

function write16bitWaveFile(fileName, signal, sr = 44100) {  
    const header = Buffer.alloc(44)
    header.asciiWrite('RIFF', 0)
    header.writeInt32LE(signal[0].length * 2 + 36, 4)
    header.asciiWrite('WAVE', 8)
    header.asciiWrite('fmt ', 12)
    header.writeInt32LE(16, 16)
    header.writeInt16LE(1, 20)
    header.writeInt16LE(signal.length, 22)
    header.writeInt32LE(sr, 24)
    header.writeInt32LE(sr * 2 * signal.length, 28)
    header.writeInt16LE(2 * signal.length, 32)
    header.writeInt16LE(16, 34)
    header.asciiWrite('data', 36)
    header.writeInt32LE(signal.length * signal[0].length * 2, 40)
    const dataBuf = Buffer.alloc(signal.length * 2 * signal[0].length)

    for (let i = 0; i < signal[0].length; i++) {
        for (let j = 0; j < signal.length; j++) {
            let val = Math.min(Math.max(signal[j][i], -1), 1)
            val *= 32767
            val = Math.floor(val)
            dataBuf.writeInt16LE(val, (i * signal.length + j) * 2)
        }
    }

    fs.writeFileSync(fileName, Buffer.concat([header, dataBuf]))
}

function read16BitWaveFile(fileName) {
    const fileBytes = fs.readFileSync(fileName)
    let dataFound = false
    const channels = fileBytes.readInt16LE(22);
    // I think that 36 is the absolute minimum position for 'data' but let's keep it simple
    // and also hope that there's no other "data" string before the actual data header
    let offset = 0
    while (!dataFound && offset < fileBytes.length) {
        offset++
        dataFound = fileBytes.asciiSlice(offset, offset + 4) === 'data'
    }
    const dataLength = fileBytes.readUInt32LE(offset + 4)
    const b = Array.from(new Int16Array(new Uint8Array(fileBytes.subarray(offset + 8, offset + 8 + dataLength)).buffer)).map(x => x * _16bitIntToFloat)
    if (channels === 1) return [b]
    const stereo = [[],[]]
    b.forEach((sample, i) => {
        stereo[i % 2][Math.floor(i / 2)] = sample
    })
    return stereo
}

module.exports = {
    _16Bit: {
        write: write16bitWaveFile,
        read: read16BitWaveFile        
    }
}