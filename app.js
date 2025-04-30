const { readFile, writeFile } = require('node:fs/promises');
const { existsSync } = require('node:fs');
const path = require('node:path');
const { Midi } = require('@tonejs/midi');

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

	for (const track of midi.tracks) {
		// Only process drum channel
		if (track.channel !== 9) {
			return;
		}

		const notes = track.notes;

		// Sort notes by time
		notes.sort((a, b) => a.time - b.time);

		// Smoothed velocity wave
		const baseVelocity = 0.85;
		const wave = [...Array(notes.length)].map((_, i) => {
			return baseVelocity + 0.1 * Math.sin(i * 0.4) + 0.03 * Math.sin(i * 3);
		});

		notes.forEach((note, i) => {
			// ---- Velocity Control ----
			let v = wave[i % wave.length];

			// Emphasize certain hits (e.g. every 4th 16th-note)
			const sixteenth = (note.time * 4) % 1 < 0.01;

			if (sixteenth && i % 4 === 0 && note.midi === 38) {
				v += 0.1; // snare accent
			}

			// Apply soft cap
			v = Math.max(0.05, Math.min(1.0, v));
			note.velocity = v;

			// ---- Timing Control ----
			// Drag snare slightly behind (4-12ms delay)
			if ([38, 40].includes(note.midi)) {
				note.time += (Math.random() * 8 + 4) / 1000;
			}

			// Push hats slightly ahead
			if ([42, 46].includes(note.midi)) {
				note.time -= (Math.random() * 4) / 1000;
			}
		});
	}

	const filename = path.basename(filePath, path.extname(filePath));
	const outPath = path.join(
		path.dirname(filePath),
		`${filename} [HUMANIZED].mid`,
	);

	await writeFile(outPath, Buffer.from(midi.toArray()));
})();
