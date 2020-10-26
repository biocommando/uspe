const notes = [["C"],["C#","DB"],["D"],["D#","EB"],["E"],["F"],["F#","GB"],["G"],["G#","AB"],["A"],["A#","BB"],["B", "H"],];

function translateNote(note) {
    if (!isNaN(Number(note))) return note
	if(typeof note != 'string' || !note) return undefined;
	var noOcatave = note.replace(/[0-9]/g, '').toUpperCase();
	var noteIdx = notes.findIndex(n => n.find(n => n === noOcatave));
	if(noteIdx === -1) return undefined;
	var octave = Number(note.replace(/[^0-9]/g, ''));
	return noteIdx + octave * 12;
}

function numToNote(num) {
    const octave = Math.floor(num / 12)
    return notes[num % 12][0] + octave
}

module.exports = { translateNote, numToNote }