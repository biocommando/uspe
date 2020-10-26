/*
tempo = 120
divisor = 16

include a.file
include another.file
    
part a:
    $1.wav 0
    $2.wav 0
    # prefix with @ -> last parameter is offset
    @b 8

part b:
    s sample2.wav


part main:
    a sample1 sample2
    + 16
    
*/

const fs = require('fs')
const child_process = require('child_process')
const waveHandler = require('./wave-file-handler')
const cache = require('./cache')
const fileQueue = require('./file-queue')

const SILENCE_FILE = 'silence-GUID-24732f5f-a7ea-4727-86a7-317979bc47ee.wav'
requirelib = lib => {
    const file = `./lib/${lib}`
    requirelib.setCacheStatus(fs.statSync(file.endsWith('.js') ? file : `${file}.js`).mtimeMs)
    return require(file)
}

const argvGet = (args, required = true) => {
    for (let i = 0; i < args.length; i++) {
        let idx = process.argv.indexOf(args[i])
        const val = process.argv[idx + 1]
        if (idx !== -1 && val) return val
    }
    if (required) throw 'Required arg not found: ' + args.join(' or ')
}

console.log('Executing with arguments', process.argv)

const inputFile = argvGet(['--input-file', '--input', '-i'])
const outputFile = argvGet(['--output-file', '--output', '-o'])

const programParams = []
for (let i = 1; argvGet(['--param-' + i, '-p' + i], false); i++) {
    programParams.push(argvGet(['--param-' + i, '-p' + i], false))
}
let dependParams = argvGet(['--depend-params', '-dp'], false)
if (dependParams) {
    const kvPairs = dependParams.split(';')
    dependParams = {}
    kvPairs.forEach(pair => {
        const kv = pair.split('=')
        dependParams[kv[0]] = kv[1]
    })
}

let playlist = []
const variables = {
    tempo: 120,
    divisor: 16,
    volume: 0.95,
    sample_rate: 44100,
    sample_directory: '',
    normalize: 1,
    channels: 1
}

const commands = []
const filesIncluded = []
const synths = [] // List of synthetizing functions
const fx = {} // Sample to effect function map; note that for e.g. reverbs you need to have enough silence in the end
let pos = 0
let dependencyIsDirty = false

const includeFile = file => {
    if (filesIncluded.some(entry => entry.file === file)) {
        console.log('File ' + file + ' already included')
        return
    }
    const contents = fs.readFileSync(file).toString()
        .replace(/\$\$(\d+?)/g, (_, n) => programParams[Number(n) - 1])
        .replace(/script;.+?script_end;/sg, x => x.replace(/\r?\n/g, ' ').replace('script_end;', ''))
        .replace(/\\ *\r?\n/g, ' ')
    filesIncluded.push({file, contents})
    contents.split(/\r?\n/).map(x => x.trim()).filter(x => x !== '' && x[0] !== '#')
        .forEach(line => {
            if (line.startsWith('script;')) {
                commands[commands.length - 1].body.push(line)
            } else if (line.startsWith('include ')) {
                const file = line.replace('include ', '')
                console.log('Including file ', file)
                includeFile(file)
            } else if (line.startsWith('depends ')) {
                const split = line.replace('depends ', '').split(' ').map(x => x.trim())
                console.log('Depending on code file ' + split[1] + ' producing file ', split[0])
                const args = ['compile-playlist.js', '--input-file', split[1], '--output-file', split[0]]                
                programParams.forEach((p, i) => args.push(`--param-${i + 1}`, p))
                if (split[2]) {
                    args.push('--depend-params', split[2])
                }
                const pr = child_process.spawnSync('node', args)
                const stdoutStr = pr.stdout.toString()
                if (!dependencyIsDirty && stdoutStr.includes('[' + cache.guid + ']')) {
                    dependencyIsDirty = true
                }
                console.log( 'EXECUTION OUTPUT:',
                    stdoutStr, pr.stderr.toString()
                )
                console.log('*********** return execution of', outputFile, 'dependency dirty?', dependencyIsDirty)
                if (pr.status !== 0) {
                    throw 'Aborting because of errors'
                }
            } else if (line.match(/^\s*[^\s]+?\s*=/)) {
                const split = line.split('=').map(x => x.trim())
                if (split[1].match(/".*"/)) {
                    variables[split[0]] = split[1].replace(/"/g, '')
                } else {
                    variables[split[0]] = Number(split[1])
                }
            } else if (line[line.length - 1] === ':') {
                const cmd = line.replace(/ .*/, '')
                name = line.replace(cmd, '').replace(':', '').trim()
                commands.push({cmd, name, body: []})
            } else {
                commands[commands.length - 1].body.push(line)
            }
        })
}

includeFile(inputFile)
let scriptCacheControl = ''

const executePart = (name, params, offset = 0) => {
    const part = commands.find(c => c.cmd === 'part' && c.name === name)
    console.log('Executing part', name, params)
    part
        .body
        .map(line => line.replace(/\$range\((\d+?)\-(\d+?) (.+?)\)/g, (_, start, end, sep) => {
            const str = Array(Number(end) - Number(start) + 1).fill().map((_, i) => '$' + (i + Number(start))).join(sep);
            return str
        }))
        .map(line => line.replace(/(\$\d\d*)/g, (_, n) => { const p = params[Number(n.substr(1)) - 1]; return p === undefined ? n : p;}))
        .forEach((line, lineIdx) => {
            // test for unresolved variables
            if (!line.startsWith('script;') && line.includes('$')) return
            let reExecScript = false
            const localVariables = {}
            do {
                let origLine = line
                if (line.startsWith('script;')) {
                    const g = variables
                    const v = localVariables
                    const isResolved = str => str[0] !== '$'
                    const getIfResolved = (str, fn, defaultVal) => {
                        if (isResolved(str)) {
                            return fn(str)
                        }
                        return defaultVal
                    }
                    const d = dependParams
                    
                    const setCacheStatus = status => {
                        const header = '<<' + lineIdx + ' ' + name + '>>'
                        if (!scriptCacheControl.includes(header)) scriptCacheControl += header + JSON.stringify(status)
                    }
                    requirelib.setCacheStatus = setCacheStatus
                    
                    const samplesToPos = n => n * g.divisor / 60 * g.tempo / 4 / g.sample_rate
                    const secondsToPos = s => samplesToPos(s * g.sample_rate)
                    
                    let r = false
                    console.log('EXECUTING: <<<'+ line + '>>>')
                    line = eval('(()=>{' + line.replace('script;', '') + '})()')
                    console.log('Script execution result:', line)
                    if (r) console.log('Re-exec flag set')
                    reExecScript = r
                    if (line === '') {
                        line = origLine
                        continue
                    }
                }
                
                const split = line.split(/  */)
                
                if (split[0].includes('.wav')) {
                    const wavPos = split[1] !== undefined ? Number(split[1]) : 0
                    const startOffset = split[2] === undefined ? undefined : Number(split[2])
                    const length = split[3] === undefined ? undefined : Number(split[3])
                    playlist.push({sample: split[0], pos: pos + offset + wavPos, startOffset, length})
                } else if (line.startsWith('+')) {
                    pos += Number(split[1])
                    console.log('Increment song position to', pos)
                } else {
                    let relPos = 0
                    if (line[0] === '@') relPos = Number(split[split.length - 1])
                    const params = split.splice(1)
                    executePart(split[0].replace('@', ''), params, offset + relPos)
                }
                line = origLine
            } while (reExecScript)
        })
}

executePart('main', [])
playlist.sort((a,b) => a.pos - b.pos).forEach(item => item.posSample = Math.round(item.pos / variables.divisor * 60 / variables.tempo * 4 * variables.sample_rate))
fileQueue.init(waveHandler._16Bit.read, playlist.map(item => variables.sample_directory + item.sample))

console.log('Generating output with playlist and variables:', playlist.map(o => Object.keys(o).filter(k => o[k] !== undefined).map(k => `${k}=${o[k]}`).join(', ')).join('\n'), variables)

const generateOutput = () => {
    let silentCounter = 1
    let pl_i = 0
    let i = 0
    const signal = [[]]
    if (variables.channels === 2) signal.push([])
    const lastSamplePos = playlist[playlist.length - 1].posSample
    while (silentCounter > 0) {
        if (playlist[pl_i] && i === playlist[pl_i].posSample) {
            let data 
            if (playlist[pl_i].sample === SILENCE_FILE) {
                data = [[0]]
            } else {
                // data = waveHandler._16Bit.read(variables.sample_directory + playlist[pl_i].sample)
                data = fileQueue.loadNext()
            }
            const effect = fx[playlist[pl_i].sample]
            const startOffset = playlist[pl_i].startOffset ? playlist[pl_i].startOffset : 0
            const playUntil = playlist[pl_i].length ? Math.min(startOffset + playlist[pl_i].length, data[0].length) : data[0].length
            for (let d_i = startOffset; d_i < playUntil; d_i++) {
                const signalPos = i + d_i - startOffset
                for (let ch = 0; ch < variables.channels; ch++) {
                    if (signal[ch][signalPos] === undefined) signal[ch][signalPos] = 0
                    const datapoint = ch < data.length ? data[ch][d_i] : data[0][d_i]
                    signal[ch][signalPos] += effect ? effect(datapoint, ch, variables.channels) : datapoint
                }
            }
            pl_i++
            if (i >= lastSamplePos) {
                silentCounter = Math.max(silentCounter, data[0].length)
            }
        } else {
            if (signal[0][i] === undefined) {
                for (let ch = 0; ch < variables.channels; ch++) {
                    signal[ch][i] = 0
                }
            }
            if (i >= lastSamplePos) {
                silentCounter--
            }
            i++
        }
    }
    let peak = 0.001
    for (let i = 0; i < signal[0].length; i++) {
        for (let ch = 0; ch < variables.channels; ch++) {
            if (signal[ch][i] === undefined) signal[ch][i] = 0
            synths.forEach(synth => signal[ch][i] += synth.process(ch, variables.channels))
            peak = Math.abs(signal[ch][i]) > peak ? Math.abs(signal[ch][i]) : peak
        }
    }
    
    if (!variables.normalize) peak = 1
    
    for (let i = 0; i < signal[0].length; i++) {
        for (let ch = 0; ch < variables.channels; ch++) {
            signal[ch][i] = variables.volume * signal[ch][i] / peak
        }
    }

    waveHandler._16Bit.write(outputFile, signal, variables.sample_rate)
}

// cache.isDirty must be called first to cache the change
// rationale for including objects to cache hashing:
// - playlist: if some scripts are not deterministic, this is required to recognize that
// - filesIncluded: file contents are saved after string substitution so all effective parameter values are already present.
//                  Files can have e.g. changes in effects or other non-playlist-modifying files so they're needed.
// - scriptCacheControl: for dependencies of all scripts
const isDirty = cache.isDirty(outputFile, [playlist, filesIncluded, scriptCacheControl]) || dependencyIsDirty || argvGet(['--no-cache', '-nc'], false)

if (isDirty) {
    console.log('[' + cache.guid + '] No cache match: generating new file')
    generateOutput()
} else {
    console.log('Cached version found; no files generated.')
}

cache.saveCache()

console.log('Generation completed without errors')