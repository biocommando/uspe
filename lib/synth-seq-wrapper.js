function getSequencedEventSender(seq, tempo, sampleRate, synthObj, setEndOfLastNote) {
    
    const events = {};
    seq.split(';').forEach(evt => {
        let [notes, pos] = evt.split('@');
        if (events[pos] === undefined) events[pos] = [];
        notes = notes.split(',').map(n => {
            const [num, len] = n.split('-');
            return {num, len};
        });
        events[pos].push(...notes);
    });
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