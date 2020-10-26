const {translateNote} = requirelib('translate-note')
const namedParams = requirelib('named-params')
const {getAdsrEnvelopeCreator} = requirelib('envelope')

const synthCreatorWrapper = (allParams, tempo, sampleRate) => {
    const params = namedParams.parse(allParams)
    let harmonics = [{f: 1, a: 1}]
    if (params.harmonics) {
        harmonics = params.harmonics.split(';').map(x => {
            const [f, a] = x.split(',').map(Number)
            return {f, a}
        })
    }
    const adsrCreator = getAdsrEnvelopeCreator(0, 0, 1, 0, sampleRate)
    ;['attack', 'decay', 'sustain', 'release'].forEach(key => {
        if (params[key] !== undefined) {
            adsrCreator.getParams()[key] = Number(params[key])
        }
    })
    let voices = [], previousOutput = 0
    return {
        process: channel => {
            if (channel !== 0) return previousOutput
            let s = 0
            voices.forEach(v => {
                v.envelope.calculateNext()
                v.phase += v.increment
                harmonics.forEach(h => {
                    if (h.f * v.freqHz * 2 > sampleRate) return
                    const ph = h.f * v.phase
                    s += Math.sin(ph) * h.a * v.envelope.envelope
                })
            })
            voices = voices.filter(v => !v.envelope.endReached)
            previousOutput = s
            return s
        },
        onEvent: event => {
            if (event.type === 'note-on') {
                const freqHz = Math.pow(2, translateNote(event.note)/12) * 16.35
                const envelope = adsrCreator.create()
                voices.push({ phase: Math.random() * Math.PI * 2, freqHz, increment: freqHz / sampleRate * Math.PI * 2, note: event.note, envelope})
            } else if (event.type === 'note-off') {
                voices.filter(v => v.note === event.note).forEach(v => v.envelope.release())
            }
        },
        setPreset: preset => {
            if (preset.harmonics) {
                harmonics = preset.harmonics
            }
            if (preset.expression) {
                eval(preset.expression.join(' '))(harmonics, namedParams.parse(params.presetparams, ':'))
            }
        }
    }
}

module.exports = {
    synthCreatorWrapper,
    hasOnEvent: true
}