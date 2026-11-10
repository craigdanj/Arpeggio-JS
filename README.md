# Guitar Arpeggio JS

A dependency-free JavaScript plugin for finding arpeggio notes and drawing an interactive SVG fretboard. It supports six-string guitar in standard E–A–D–G–B–E tuning, from open strings through fret 24.

Open `guitar-arpeggio-demo.html` in a browser to try it. The demo is self-contained and works offline. It includes a full-neck map, five-fret position views, sweep tablature, and audio previews.

## Draw a position

```html
<div id="fretboard" style="overflow-x: auto"></div>
<script src="./guitar-arpeggio.js"></script>
<script>
  const view = GuitarArpeggio.getPosition({
    root: 'A',
    type: 'm7',
    startFret: 5,
    endFret: 9,
  });

  GuitarArpeggio.draw(document.querySelector('#fretboard'), {
    ...view,
    label: 'degrees',
    onNote(note) {
      console.log(note.name, note.string, note.fret, note.midi);
    },
  });
</script>
```

The browser script exposes `GuitarArpeggio`. In CommonJS, use `const GuitarArpeggio = require('./guitar-arpeggio.js')`. The chord and pattern functions can run without a DOM.

## Find sweep shapes

```js
const patterns = GuitarArpeggio.getSweepPatterns({
  root: 'A',
  type: 'minor',
  strings: 6,
  maxSpan: 5,
});

const rootPosition = patterns.find((pattern) => pattern.notes[0].degree === '1');

if (rootPosition) {
  GuitarArpeggio.draw(document.querySelector('#fretboard'), {
    ...rootPosition,
    chord: GuitarArpeggio.getChord('A', 'minor'),
    route: rootPosition.notes,
    label: 'order',
  });
}
```

| API | Behavior |
| --- | --- |
| `getChord(root, type)` | Returns the chord symbol and diatonically spelled pitch classes and degrees. Defaults to A minor. Accepts ASCII or Unicode accidentals. |
| `getPosition({ root, type, startFret, endFret })` | Returns all chord tones in an inclusive fret range. Defaults to frets 0–24. |
| `getSweepPatterns({ root, type, strings, startFret, endFret, maxSpan })` | Returns ascending shapes across 3 (G–e), 5 (A–e), or 6 (E–e) adjacent strings, with 6 as the default. The inclusive fret span defaults to 5. A restricted range can return an empty array. |
| `draw(container, { notes, startFret, endFret, chord, route, label, leftHanded, onNote })` | Replaces the container contents with an SVG. Labels can show `degrees`, `notes`, or `order` when a route is supplied. Set `leftHanded: true` to mirror the neck. A supplied `onNote` enables pointer and keyboard interaction. |
| `ROOTS`, `CHORDS`, `STANDARD_TUNING` | Expose the 12 default root spellings, supported chord definitions, and tuning in MIDI notes from low E to high e. |

The 16 chord types are `major`, `minor`, `diminished`, `augmented`, `sus2`, `sus4`, `6`, `m6`, `maj7`, `7`, `m7`, `mMaj7`, `m7b5`, `dim7`, `add9`, and `9`.

Each note has a `string` number (1 = high e, 6 = low E), a `fret`, a `midi` pitch, a `name`, and a chord `degree`. Sweep shapes include every chord tone within the specified span. They use one note on each inner string and up to two on the outer strings. The generator keeps one shape per bass-string starting fret, favoring nearby chord tones and smaller fret shifts. Shapes may start on any chord tone, and can skip pitches across strings.

The renderer exposes `--gaj-wood`, `--gaj-fret`, `--gaj-string`, `--gaj-root`, `--gaj-tone`, `--gaj-route`, and other CSS custom properties for theming. Audio playback and tablature are implemented in the demo. Use the note data and `onNote` callback to integrate your own playback.
