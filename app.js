const { readFile, writeFile } = require('node:fs/promises');
const { existsSync } = require('node:fs');
const path = require('node:path');
const { Midi } = require('@tonejs/midi');

const SNARE_NOTES = [38, 40];

const KICK_NOTES = [38, 40];

const HI_HAT_NOTES = [42, 46];

const BLAST_START_NOTE = 69;

const BLAST_END_NOTE = 70;

(async () => {
	const filePath = process.argv[2];

	if (!filePath || !existsSync(filePath)) {
		console.error(
			'Please provide a valid MIDI file path as the first argument.',
		);
		process.exit(1);
	}

	const data = await readFile(filePath);

	const midi = new Midi(data);

	const blastSections = [];

	for (const track of midi.tracks) {
		let currentBlastStart = null;

		// Track marker notes and remove them
		track.notes = track.notes.filter((note) => {
			if (note.midi === BLAST_START_NOTE) {
				currentBlastStart = note.time;
				return false; // remove from final output
			}
			if (note.midi === BLAST_END_NOTE && currentBlastStart !== null) {
				blastSections.push({ start: currentBlastStart, end: note.time });
				currentBlastStart = null;
				return false; // remove from final output
			}
			return true;
		});
	}

	const isBlastMode = (time) =>
		blastSections.some(
			(section) => time >= section.start && time <= section.end,
		);

	for (const track of midi.tracks) {
		if (track.channel !== 9) {
			continue;
		}

		const notes = track.notes;
		notes.sort((a, b) => a.time - b.time);

		const baseVelocity = 0.85;
		const wave = [...Array(notes.length)].map(
			(_, i) => baseVelocity + 0.1 * Math.sin(i * 0.4) + 0.03 * Math.sin(i * 3),
		);

		for (let i = 0; i < notes.length; i++) {
			const note = notes[i];

			if (isBlastMode(note.time)) {
				if (SNARE_NOTES.includes(note.midi)) {
					note.velocity = 0.7 + Math.random() * 0.1; // lowered velocity
					note.time += (Math.random() * 3) / 1000;
				}

				if (HI_HAT_NOTES.includes(note.midi)) {
					note.velocity = 0.65 + Math.random() * 0.1; // slightly lower too
					note.time += (Math.random() * 2 - 1) / 1000;
				}

				if (KICK_NOTES.includes(note.midi)) {
					note.velocity = Math.min(
						1,
						Math.max(0.7, note.velocity + (Math.random() - 0.5) * 0.1),
					);
					note.time += (Math.random() * 2 - 1) / 1000;
				}
			} else {
				let v = wave[i % wave.length];
				const sixteenth = (note.time * 4) % 1 < 0.01;

				if (sixteenth && i % 4 === 0 && note.midi === 38) {
					v += 0.1;
				}

				v = Math.max(0.05, Math.min(1.0, v));
				note.velocity = v;

				if (SNARE_NOTES.includes(note.midi)) {
					note.time += (Math.random() * 8 + 4) / 1000;
				}

				if (HI_HAT_NOTES.includes(note.midi)) {
					note.time -= (Math.random() * 4) / 1000;
				}
			}
		}
	}

	const filename = path.basename(filePath, path.extname(filePath));
	const outPath = path.join(
		path.dirname(filePath),
		`${filename} [HUMANIZED].mid`,
	);

	await writeFile(outPath, Buffer.from(midi.toArray()));
	console.log(`✅ Humanized file saved to:\n${outPath}`);
})();
