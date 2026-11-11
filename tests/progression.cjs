const assert = require('node:assert/strict');
const G = require('../guitar-arpeggio.js');
const suffixes = Object.entries(G.CHORDS);
for (const root of G.ROOTS) {
  for (const [type, definition] of suffixes) {
    assert.deepEqual(G.parseProgression(root + definition.suffix), [{root, type}]);
    for (const strings of [3,5,6]) {
      const result = G.getProgression({chords:[{root,type},{root:'G',type:'7'},{root:'C',type:'maj7'}],strings,loop:true,endFret:15});
      assert.equal(result.steps.length,3);
      result.steps.forEach((step,i) => {
        assert.equal(new Set(step.notes.map(n=>n.pitch)).size, step.chord.tones.length);
        assert(step.notes.every(n=>n.fret >= 0 && n.fret <= 15));
        assert.equal(new Set(step.notes.map(n=>n.string)).size,strings);
        assert(step.notes.every((n,j)=>j===0 || n.midi > step.notes[j-1].midi));
        const next = result.steps[(i+1)%3];
        assert.deepEqual(result.transitions[i].commonTones.map(t=>t.pitch), step.chord.tones.filter(t=>next.chord.tones.some(n=>n.pitch===t.pitch)).map(t=>t.pitch));
        assert(result.transitions[i].targetNotes.every(n=>!step.notes.some(t=>n.string===t.string && n.fret===t.fret)));
      });
    }
  }
}
assert.deepEqual(G.parseProgression('Dm7 → G7 | Cmaj7, A♭m7♭5'), [
  {root:'D',type:'m7'},{root:'G',type:'7'},{root:'C',type:'maj7'},{root:'Ab',type:'m7b5'}
]);
for (const chords of ['', 'H7', 'C/E', 'C13', 'Am banana', 'C '.repeat(33)]) assert.throws(()=>G.parseProgression(chords));
for (const options of [{startFret:8,endFret:3},{targetFret:2.5},{startFret:NaN},{startFret:0,endFret:0},{strings:4}]) assert.throws(()=>G.getProgression(options));
assert.equal(G.getProgression({loop:false}).transitions.at(-1),null);
assert.equal(G.getProgression({chords:'Am',loop:true}).steps.length,1);
assert.equal(G.getProgression({chords:'C '.repeat(32)}).steps.length,32);
// Compare the planner to exhaustive search on a small candidate set.
const center = s=>(s.startFret+s.endFret)/2;
const move = (a,b)=>a.notes.reduce((sum,n)=>sum+Math.min(...b.notes.filter(t=>t.string===n.string).map(t=>Math.abs(t.fret-n.fret))),0)/a.notes.length;
const local = s=>Math.abs(center(s)-5)*.35+(s.endFret-s.startFret)*.1;
const cost = (steps,loop)=>steps.reduce((sum,s,i)=>sum+local(s)+(i?move(steps[i-1],s)+Math.abs(center(steps[i-1])-center(s)):0),0)+(loop?move(steps.at(-1),steps[0])+Math.abs(center(steps.at(-1))-center(steps[0])):0);
const chords=G.parseProgression('Dm7 G7 Cmaj7');
const choices=chords.map(c=>G.getSweepPatterns({...c,strings:3,endFret:9}));
for (const loop of [false,true]) {
  let minimum=Infinity;
  for(const a of choices[0]) for(const b of choices[1]) for(const c of choices[2]) minimum=Math.min(minimum,cost([a,b,c],loop));
  const planned=G.getProgression({chords,strings:3,endFret:9,loop});
  assert(Math.abs(cost(planned.steps,loop)-minimum)<1e-8);
}
console.log('Passed: 576 progression plans, all chord-symbol round trips, ranges, common tones, loop closure, and exhaustive optimality checks.');
