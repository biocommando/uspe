const fs = require('fs')

function parsePianorollFile(file) {
    let lines = fs.readFileSync(file).toString().split(/\r?\n/).filter(x => x[0] === '@')
    const events = {}
    lines.forEach(x => {
        const note = x.substr(1).split('|')[0].trim()
        let currentNote = undefined
        const steps = x.replace(/[^.x-]/g, '').split('')
        steps.forEach((step, idx) => {
            let addNote = false
            if (step === 'x' || (step === '-' && !currentNote)) {
                currentNote = {pos: idx, len: 1}
            } else if (step === '-') {
                currentNote.len++
            } else if (currentNote) {
                addNote = true
            }
            if (currentNote && idx === steps.length - 1) {
                addNote = true
            }
            if (addNote) {
                const {pos, len} = currentNote
                if (!events[pos]) events[pos] = []
                events[pos].push({num: note, len})
                currentNote = undefined
            }
        })
    })
    return events
}

function getSequencedEventSender(seq, tempo, sampleRate, synthObj, setEndOfLastNote) {
    let events = {}
    if (seq.endsWith('.pianoroll')) {
        events = parsePianorollFile(seq)
    } else {
        seq.split(';').forEach(evt => {
            let [notes, pos] = evt.split('@');
            if (events[pos] === undefined) events[pos] = [];
            notes = notes.split(',').map(n => {
                const [num, len] = n.split('-');
                return {num, len};
            });
            events[pos].push(...notes);
        });
    }
    const playlist = [];
    const posToSamples =  p => Math.round(p * sampleRate / tempo * 15);
    Object.keys(events).forEach(pos => {
        events[pos].forEach(evt => {
            playlist.push({samplePos: posToSamples(pos), event: 'note-on', note: evt.num});
            playlist.push({samplePos: posToSamples(pos) + posToSamples(evt.len), event: 'note-off', note: evt.num});
        });
    });
    
    playlist.sort((a, b) => a.samplePos - b.samplePos);
    
    setEndOfLastNote(playlist[playlist.length - 1].samplePos / sampleRate * tempo / 15 + 16);
    
    let nextPlaylistId = 0;
    let sampleIdx = 0;

    const process = channel => {
        if (channel === 0) {
            while (nextPlaylistId < playlist.length && sampleIdx === playlist[nextPlaylistId].samplePos) {
                synthObj.onEvent({type: playlist[nextPlaylistId].event, note: playlist[nextPlaylistId].note});
                nextPlaylistId++;
            }
            sampleIdx++;
        }
        return synthObj.process(channel);
    }
    
    const wrapped = { process }
    
    if (synthObj.setPreset) {
        wrapped.setPreset = synthObj.setPreset
    }
    
    return wrapped
}

module.exports = {
    getSequencedEventSender
}