/*! Guitar Arpeggio JS */
(function (factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else globalThis.GuitarArpeggio = factory();
})(function () {
  'use strict';

  const STANDARD_TUNING = Object.freeze([40, 45, 50, 55, 59, 64]);
  const STRINGS = ['E', 'A', 'D', 'G', 'B', 'e'];
  const ROOTS = Object.freeze(['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']);
  const NATURAL = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const LETTERS = Object.keys(NATURAL);
  const SVG = 'http://www.w3.org/2000/svg';

  const CHORDS = Object.freeze(Object.fromEntries([
    ['major', 'Major', '', [0, 4, 7], ['1', '3', '5']],
    ['minor', 'Minor', 'm', [0, 3, 7], ['1', '♭3', '5']],
    ['diminished', 'Diminished', 'dim', [0, 3, 6], ['1', '♭3', '♭5']],
    ['augmented', 'Augmented', 'aug', [0, 4, 8], ['1', '3', '♯5']],
    ['sus2', 'Suspended 2', 'sus2', [0, 2, 7], ['1', '2', '5']],
    ['sus4', 'Suspended 4', 'sus4', [0, 5, 7], ['1', '4', '5']],
    ['6', 'Major 6', '6', [0, 4, 7, 9], ['1', '3', '5', '6']],
    ['m6', 'Minor 6', 'm6', [0, 3, 7, 9], ['1', '♭3', '5', '6']],
    ['maj7', 'Major 7', 'maj7', [0, 4, 7, 11], ['1', '3', '5', '7']],
    ['7', 'Dominant 7', '7', [0, 4, 7, 10], ['1', '3', '5', '♭7']],
    ['m7', 'Minor 7', 'm7', [0, 3, 7, 10], ['1', '♭3', '5', '♭7']],
    ['mMaj7', 'Minor major 7', 'm(maj7)', [0, 3, 7, 11], ['1', '♭3', '5', '7']],
    ['m7b5', 'Half diminished', 'm7♭5', [0, 3, 6, 10], ['1', '♭3', '♭5', '♭7']],
    ['dim7', 'Diminished 7', 'dim7', [0, 3, 6, 9], ['1', '♭3', '♭5', '𝄫7']],
    ['add9', 'Major add9', 'add9', [0, 2, 4, 7], ['1', '9', '3', '5']],
    ['9', 'Dominant 9', '9', [0, 2, 4, 7, 10], ['1', '9', '3', '5', '♭7']],
  ].map(([id, name, suffix, intervals, degrees]) => [id, Object.freeze({
    name, suffix, intervals: Object.freeze(intervals), degrees: Object.freeze(degrees),
  })])));

  const mod = (n, divisor = 12) => ((n % divisor) + divisor) % divisor;
  const pretty = (s) => s.replaceAll('#', '♯').replaceAll('b', '♭');

  function getChord(root = 'A', type = 'minor') {
    const match = /^([A-G])([#b]?)$/i.exec(String(root).trim().replaceAll('♯', '#').replaceAll('♭', 'b'));
    if (!match) throw new RangeError('Choose a root from A to G with an optional sharp or flat.');
    if (!Object.hasOwn(CHORDS, type)) throw new RangeError('Unknown chord type.');
    const letter = match[1].toUpperCase();
    const accidental = match[2].toLowerCase();
    const pitch = mod(NATURAL[letter] + (accidental === '#' ? 1 : accidental === 'b' ? -1 : 0));
    const definition = CHORDS[type];
    const tones = definition.intervals.map((interval, index) => {
      const degree = definition.degrees[index];
      const toneLetter = LETTERS[mod(LETTERS.indexOf(letter) + Number(degree.match(/\d+/)[0]) - 1, 7)];
      const tonePitch = mod(pitch + interval);
      const alteration = mod(tonePitch - NATURAL[toneLetter] + 6) - 6;
      const sign = alteration < 0 ? '♭' : '♯';
      const spelling = { '-2': '𝄫', 2: '𝄪' }[alteration] ?? sign.repeat(Math.abs(alteration));
      const name = toneLetter + spelling;
      return { interval, degree, name, pitch: tonePitch, index };
    });
    const name = pretty(letter + accidental);
    return { root: name, symbol: name + definition.suffix, type, tones };
  }

  function fretNumber(value) {
    if (!Number.isInteger(value) || value < 0 || value > 24) {
      throw new RangeError('Frets must be integers from 0 through 24.');
    }
    return value;
  }

  function boardNotes(chord, startFret, endFret) {
    fretNumber(startFret);
    fretNumber(endFret);
    if (startFret > endFret) throw new RangeError('The start fret must precede the end fret.');
    const tones = new Map(chord.tones.map((tone) => [tone.pitch, tone]));
    return STANDARD_TUNING.flatMap((openMidi, stringIndex) => {
      const notes = [];
      for (let fret = startFret; fret <= endFret; fret++) {
        const midi = openMidi + fret;
        const tone = tones.get(mod(midi));
        if (tone) notes.push({ ...tone, string: 6 - stringIndex, fret, midi });
      }
      return notes;
    });
  }

  function getPosition({ root, type, startFret = 0, endFret = 24 } = {}) {
    const chord = getChord(root, type);
    return { chord, startFret, endFret, notes: boardNotes(chord, startFret, endFret) };
  }

  function getSweepPatterns({ root, type, strings = 6, startFret = 0, endFret = 24, maxSpan = 5 } = {}) {
    if (![3, 5, 6].includes(strings)) throw new RangeError('Choose 3, 5 or 6 sweep strings.');
    if (!Number.isInteger(maxSpan) || maxSpan < 2 || maxSpan > 6) {
      throw new RangeError('The sweep span must be between 2 and 6 frets.');
    }
    const chord = getChord(root, type);
    const tones = chord.tones.length;
    const notes = boardNotes(chord, startFret, endFret);
    const groups = Array.from({ length: strings }, (_, index) => notes.filter((note) => note.string === strings - index));
    const choices = groups.map((group, index) => group.flatMap((note, noteIndex) => {
      const next = group[noteIndex + 1];
      return (index === 0 || index === groups.length - 1) && next ? [[note], [note, next]] : [[note]];
    }));
    const bestAtFret = new Map();

    function visit(path, index, low, high, mask, score) {
      if (index === strings) {
        if (mask !== (1 << tones) - 1) return;
        // Compare shapes with the same bass-string starting fret.
        const rank = score * 10 + (high - low) * 2 + (path[0].degree === '1' ? 0 : 4) - path.length;
        const key = path[0].fret;
        if (!bestAtFret.has(key) || rank < bestAtFret.get(key).rank) {
          bestAtFret.set(key, { notes: path, startFret: low, endFret: high, rank });
        }
        return;
      }
      const previous = path.at(-1);
      for (const choice of choices[index]) {
        const first = choice[0];
        const last = choice.at(-1);
        if (previous && first.midi <= previous.midi) continue;
        const nextLow = Math.min(low, first.fret);
        const nextHigh = Math.max(high, last.fret);
        if (nextHigh - nextLow + 1 > maxSpan) continue;
        const nextMask = choice.reduce((used, note) => used | (1 << note.index), mask);
        // Prefer nearby chord tones, including across the octave boundary.
        const jump = previous ? mod(first.index - previous.index - 1, tones) : 0;
        const shift = previous ? Math.abs(first.fret - previous.fret) : 0;
        visit([...path, ...choice], index + 1, nextLow, nextHigh, nextMask, score + jump * 3 + shift);
      }
    }

    visit([], 0, Infinity, -Infinity, 0, 0);
    return [...bestAtFret.values()]
      .sort((a, b) => a.startFret - b.startFret || a.rank - b.rank)
      .map(({ rank, ...shape }) => shape);
  }

  const SUFFIXES = Object.freeze({
    '': 'major', maj: 'major', major: 'major', M: 'major',
    m: 'minor', min: 'minor', minor: 'minor', '-': 'minor',
    dim: 'diminished', '°': 'diminished', aug: 'augmented', '+': 'augmented',
    sus2: 'sus2', sus4: 'sus4', '6': '6', m6: 'm6',
    maj7: 'maj7', M7: 'maj7', 'Δ7': 'maj7', '7': '7', m7: 'm7', min7: 'm7',
    mMaj7: 'mMaj7', 'm(maj7)': 'mMaj7', mM7: 'mMaj7',
    m7b5: 'm7b5', 'ø7': 'm7b5', dim7: 'dim7', '°7': 'dim7', add9: 'add9', '9': '9',
  });

  function parseProgression(input) {
    if (typeof input !== 'string') throw new TypeError('Enter a progression as chord symbols.');
    const tokens = input.trim().split(/[\s,|→>]+/u).filter(Boolean);
    if (!tokens.length || tokens.length > 32) throw new RangeError('Enter between 1 and 32 chords.');
    return tokens.map((token, index) => {
      const normalized = token.replaceAll('♯', '#').replaceAll('♭', 'b');
      const match = /^([A-Ga-g][#b]?)(.*)$/.exec(normalized);
      if (!match || !Object.hasOwn(SUFFIXES, match[2])) {
        throw new RangeError(`Chord ${index + 1}: “${token}” is unsupported. Try Dm7, G7 or Cmaj7; slash chords are not supported.`);
      }
      return { root: match[1][0].toUpperCase() + match[1].slice(1), type: SUFFIXES[match[2]] };
    });
  }

  const center = (shape) => (shape.startFret + shape.endFret) / 2;
  // Compare the nearest pitch/fret on each corresponding string. This measures
  // hand movement between shapes, not a promise of composed melodic voice leading.
  function movement(from, to) {
    return from.notes.reduce((total, note) => total + Math.min(...to.notes
      .filter((target) => target.string === note.string)
      .map((target) => Math.abs(target.fret - note.fret))), 0) / from.notes.length;
  }

  function getProgression({ chords = 'Dm7 G7 Cmaj7', strings = 6, startFret = 0,
    endFret = 24, maxSpan = 5, targetFret = 5, loop = false } = {}) {
    const entries = typeof chords === 'string' ? parseProgression(chords) : chords;
    if (!Array.isArray(entries) || !entries.length || entries.length > 32) {
      throw new RangeError('Provide between 1 and 32 chords.');
    }
    fretNumber(targetFret);
    const definitions = entries.map((entry) => getChord(entry.root, entry.type));
    const candidates = entries.map((entry, index) => {
      const shapes = getSweepPatterns({ ...entry, strings, startFret, endFret, maxSpan });
      if (!shapes.length) throw new RangeError(`No ${strings}-string shape for ${definitions[index].symbol} in frets ${startFret}–${endFret}. Widen the range or use fewer strings.`);
      return shapes;
    });
    const localCost = (shape) => Math.abs(center(shape) - targetFret) * 0.35 + (shape.endFret - shape.startFret) * 0.1;
    const transitionCost = (from, to) => movement(from, to) + Math.abs(center(from) - center(to));
    // Dynamic programming considers the whole progression. For a loop, try each
    // first shape and include the final-to-first transition in the total cost.
    let best;
    const starts = loop ? candidates[0].map((_, index) => index) : [null];
    for (const fixedStart of starts) {
      let costs = candidates[0].map((shape, index) => fixedStart === null || fixedStart === index ? localCost(shape) : Infinity);
      const parents = [];
      for (let step = 1; step < candidates.length; step++) {
        const back = [];
        const nextCosts = candidates[step].map((shape) => {
          let value = Infinity, parent = 0;
          candidates[step - 1].forEach((previous, index) => {
            const score = costs[index] + transitionCost(previous, shape) + localCost(shape);
            if (score < value) { value = score; parent = index; }
          });
          back.push(parent);
          return value;
        });
        parents.push(back);
        costs = nextCosts;
      }
      costs.forEach((cost, last) => {
        const score = cost + (loop ? transitionCost(candidates.at(-1)[last], candidates[0][fixedStart]) : 0);
        if (!best || score < best.score) {
          const indices = [last];
          for (let step = parents.length - 1; step >= 0; step--) indices.unshift(parents[step][indices[0]]);
          best = {score, indices};
        }
      });
    }
    const steps = best.indices.map((index, step) => ({ ...candidates[step][index], chord: definitions[step] }));
    const transitions = steps.map((from, index) => {
      const to = steps[index + 1] ?? (loop ? steps[0] : null);
      if (!to) return null;
      const commonTones = from.chord.tones.filter((tone) => to.chord.tones.some((target) => target.pitch === tone.pitch));
      const targetNotes = to.notes.filter((note) => !from.notes.some((current) => current.string === note.string && current.fret === note.fret));
      return { commonTones, targetNotes, movement: movement(from, to) };
    });
    return { steps, transitions, loop: Boolean(loop), startFret, endFret, targetFret };
  }

  function draw(container, { notes, startFret, endFret, chord, label = 'degrees', route = [], leftHanded = false, nextNotes = [], commonPitches = [], onNote } = {}) {
    if (!container || typeof container.replaceChildren !== 'function') throw new TypeError('Provide a DOM container.');
    fretNumber(startFret);
    fretNumber(endFret);
    if (endFret < startFret) throw new RangeError('The start fret must precede the end fret.');
    const doc = container.ownerDocument;
    const fretCount = endFret - startFret + 1;
    const spacing = Math.round(Math.max(53, Math.min(130, (container.clientWidth - 84) / fretCount)));
    const width = 84 + fretCount * spacing;
    const height = 252;
    const offset = 43;
    const firstY = 57;
    const rowGap = 31;
    const flip = (x) => leftHanded ? width - x : x;
    const fretX = (fret) => flip(offset + (fret - startFret + 0.5) * spacing);
    const stringY = (string) => firstY + (string - 1) * rowGap;

    function add(parent, tag, attrs, content) {
      const element = doc.createElementNS(SVG, tag);
      for (const [name, value] of Object.entries(attrs)) element.setAttribute(name, value);
      if (content != null) element.textContent = content;
      parent.appendChild(element);
      return element;
    }

    const svg = doc.createElementNS(SVG, 'svg');
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('width', width);
    svg.setAttribute('height', height);
    svg.setAttribute('class', 'gaj-board');
    svg.setAttribute('role', onNote ? 'group' : 'img');
    svg.setAttribute('aria-label', `${chord?.symbol ?? 'Arpeggio'} guitar fretboard, frets ${startFret} through ${endFret}`);
    svg.style.cssText = `display:block;width:100%;min-width:${84 + fretCount * 47}px;max-width:${width}px;height:auto;margin-inline:auto;font-family:system-ui,sans-serif;`;

    const boardStart = offset + (startFret === 0 ? spacing : 0);
    const boardEnd = width - offset + 2;
    const boardWidth = Math.max(0, boardEnd - boardStart);
    add(svg, 'rect', {
      x: leftHanded ? flip(boardEnd) : boardStart, y: 40, width: boardWidth, height: 190, rx: 7,
      fill: 'var(--gaj-wood, #2c3636)',
    });

    for (let fret = startFret; fret <= endFret; fret++) {
      const x = fretX(fret);
      add(svg, 'text', { x, y: 23, fill: 'var(--gaj-ink, #e4e9e6)', 'font-size': 12, 'text-anchor': 'middle' }, fret);
      if (fret % 12 === 0 && fret !== 0) {
        for (const y of [104, 166]) add(svg, 'circle', { cx: x, cy: y, r: 4, fill: 'var(--gaj-inlay, #8a9995)' });
      } else if ([3, 5, 7, 9].includes(fret % 12)) {
        add(svg, 'circle', { cx: x, cy: 135, r: 4, fill: 'var(--gaj-inlay, #8a9995)' });
      }
      const lineX = flip(offset + (fret - startFret + 1) * spacing);
      add(svg, 'line', { x1: lineX, x2: lineX, y1: 41, y2: 229, stroke: 'var(--gaj-fret, #808d88)', 'stroke-width': fret === 0 ? 4 : 1 });
    }

    for (let string = 1; string <= 6; string++) {
      const y = stringY(string);
      add(svg, 'line', { x1: flip(offset), x2: flip(boardEnd), y1: y, y2: y, stroke: 'var(--gaj-string, #b0bcb6)', 'stroke-width': 0.75 + string * 0.23 });
      add(svg, 'text', {
        x: flip(21), y, fill: 'var(--gaj-ink, #e4e9e6)', 'font-size': 13,
        'text-anchor': 'middle', 'dominant-baseline': 'central',
      }, STRINGS[6 - string]);
    }

    for (const note of nextNotes) {
      if (note.fret < startFret || note.fret > endFret) continue;
      const marker = add(svg, 'g', {class: 'gaj-next-note'});
      add(marker, 'title', {}, `Next chord: ${note.name}, string ${note.string}, fret ${note.fret}`);
      add(marker, 'circle', {cx: fretX(note.fret), cy: stringY(note.string), r: 13,
        fill: 'none', stroke: 'var(--gaj-next, #98bfff)', 'stroke-width': 2, 'stroke-dasharray': '3 3'});
    }

    const ordered = new Map(route.map((note, index) => [`${note.string}:${note.fret}`, index + 1]));
    if (route.length > 1) {
      add(svg, 'polyline', {
        points: route.map((note) => `${fretX(note.fret)},${stringY(note.string)}`).join(' '),
        fill: 'none', stroke: 'var(--gaj-route, #d7a8fa)', 'stroke-width': 2.2, 'stroke-linejoin': 'round',
      });
    }

    for (const note of notes) {
      const { fret, string, degree, name } = note;
      if (fret < startFret || fret > endFret) continue;
      const x = fretX(fret);
      const y = stringY(string);
      const step = ordered.get(`${string}:${fret}`);
      const description = `${name}, degree ${degree}, string ${string}, fret ${fret}${step ? `, step ${step}` : ''}`;
      const attrs = { class: 'gaj-note', 'data-string': string, 'data-fret': fret, 'data-midi': note.midi };
      if (onNote) Object.assign(attrs, { role: 'button', tabindex: 0, 'aria-label': description, style: 'cursor:pointer' });
      const marker = add(svg, 'g', attrs);
      if (commonPitches.includes(note.pitch)) {
        add(marker, 'circle', {cx: x, cy: y, r: 17, fill: 'none',
          stroke: 'var(--gaj-next, #98bfff)', 'stroke-width': 2});
      }
      add(marker, 'title', {}, description);
      const isRoot = degree === '1';
      add(marker, 'circle', {
        cx: x, cy: y, r: 13, fill: isRoot ? 'var(--gaj-root, #ebae71)' : 'var(--gaj-tone, #a9dac7)',
        stroke: 'var(--gaj-outline, #192423)', 'stroke-width': isRoot ? 2 : 1,
      });
      add(marker, 'text', {
        x, y, 'dominant-baseline': 'central', 'text-anchor': 'middle',
        'font-size': 10, 'font-weight': 750, fill: 'var(--gaj-label, #142321)', 'pointer-events': 'none',
      }, label === 'notes' ? name : label === 'order' && step ? step : degree);
      if (onNote) {
        marker.addEventListener('click', () => onNote(note));
        marker.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onNote(note);
          }
        });
      }
    }
    container.replaceChildren(svg);
    return svg;
  }

  return Object.freeze({ ROOTS, CHORDS, STANDARD_TUNING, getChord, getPosition, getSweepPatterns, parseProgression, getProgression, draw });
});
