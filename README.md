# Guitar Arpeggio JS

A dependency-free JavaScript plugin for finding arpeggio notes and drawing an interactive SVG fretboard. It supports six-string guitar in standard E–A–D–G–B–E tuning, from open strings through fret 24.

Open `guitar-arpeggio-demo.html` in a browser to try it. The demo is self-contained and works offline. It includes a full-neck map, five-fret position views, sweep tablature, chord progressions, and audio previews.

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


## Chord progression mode

In the demo, choose **Chord progression** in the View menu. Enter `Dm7 G7 Cmaj7` and press **Apply** (or Enter). Spaces, commas, `|`, `>` and `→` separate chords. Try the jazz, pop, minor turnaround, and 12-bar blues presets.

- Set the lowest and highest allowed frets and a preferred fret. Choose 3, 5, or 6 strings using **Sweep strings**. The planner finds a complete sweep shape for every chord within the range; it reports a helpful error if the range is too narrow.
- Click a chord card to inspect its tab and fretboard. Solid blue rings mark tones shared with the following chord; dashed blue circles show new locations in the next shape. Toggle **Show next chord** to hide both overlays. These overlays use the selected next shape, including the return to the first chord when Loop is enabled.
- Choose tempo, direction, and **2, 4, or 8 beats per chord**, then press **Play progression**. Playback starts at the selected card, plays eighth notes and repeats or truncates each pattern to fill its chord. The tab shows one complete directional pattern rather than a rhythm transcription of those repetitions.
- **Loop** repeats the progression and includes the last-to-first change when selecting shapes. With Loop off, playback finishes after the last chord. Stop, selecting another card, or changing a setting cancels playback. Edited chord text requires Apply before playback resumes.

```js
const progression = GuitarArpeggio.getProgression({
  chords: 'Dm7 → G7 → Cmaj7',
  strings: 6,
  startFret: 0,
  endFret: 15,
  targetFret: 5,
  maxSpan: 5,
  loop: true,
});

const step = progression.steps[0];
const transition = progression.transitions[0];
GuitarArpeggio.draw(document.querySelector('#fretboard'), {
  ...step,
  route: step.notes,
  nextNotes: transition?.targetNotes ?? [],
  commonPitches: transition?.commonTones.map((tone) => tone.pitch) ?? [],
});
```

`parseProgression(text)` returns `{root, type}` entries. Chord symbols support all 16 plugin types, including `C`, `Cm`, `Cdim`, `Caug`, `Csus2`, `Csus4`, `C6`, `Cm6`, `Cmaj7`, `C7`, `Cm7`, `Cm(maj7)`, `Cm7b5`, `Cdim7`, `Cadd9` and `C9`. ASCII/Unicode accidentals and aliases such as `min`, `M7`, `ø7`, and `°7` are accepted. Major/minor suffixes are case sensitive: `CM7` is major seventh, `Cm7` is minor seventh. Slash chords, Roman numerals, unsupported extensions, and empty progressions are rejected. The limit is 32 chords.

`getProgression(options)` also accepts an array of `{root, type}` entries. It returns `{steps, transitions, loop, startFret, endFret, targetFret}`. Each step contains `chord`, `notes`, `startFret` and `endFret`. Each transition contains `commonTones`, `targetNotes`, and `movement` (average nearest-fret distance on the same string). The final transition is `null` when Loop is off. Defaults are `Dm7 G7 Cmaj7`, 6 strings, frets 0–24, preferred fret 5, span 5, and Loop off.

The planner uses dynamic programming over the sweep generator's candidates to reduce fret-center shifts and nearest-note movement on corresponding strings across the entire progression. The preferred fret is a soft preference. Loop planning includes the closing transition. These are generated practice routes, not curated fingerings or independently composed melodic voice leading.

`draw` additionally accepts `nextNotes` and `commonPitches`; style both overlays with `--gaj-next`.

## Validation

Run `node tests/progression.cjs` and `node tests/demo.cjs`. The data suite checks 576 progression plans across all keys, chord types and string counts, symbol parsing, fret limits, common tones, and optimal selection against an exhaustive small search. The demo transport was additionally checked with simulated DOM and Web Audio APIs; browser visual inspection and listening remain manual checks.
