// Chapter 5: rust and scale. Two slow processes, modelled year by year.
//
// Sacrificial anode. Faraday's law: Mg → Mg²⁺ + 2e⁻, so 1 A for a year dissolves
//   3.156e7 s × 24.305 g/mol ÷ (2 × 96,485 C/mol) ≈ 3.97 kg of magnesium.
// Magnesium anodes deliver only about half of that as useful current (the rest self-corrodes):
// current efficiency ≈ 50% (NACE / DNV-RP-B401 give 0.5 for Mg). The protection current through a
// glass-lined tank's tiny flaws is a few milliamps; we assume 2 mA plus 0.01 mA per ppm of hardness,
// since harder water carries more dissolved salts and conducts better (an illustrative assumption).
// Rod: 20 mm across, 200 mm long, 1.74 g/cm³ → about 110 g. That gives lives of roughly 1.5–4 years,
// in line with makers' advice to check the anode every year or two.
//
// Scale. Heating makes dissolved calcium bicarbonate drop out as calcium carbonate:
//   Ca(HCO₃)₂ → CaCO₃↓ + CO₂ + H₂O.
// We assume a family heats 60 L a day and 0.5% of the hardness ends up on the element (the rest
// stays dissolved, settles as sludge or leaves with the water), porous scale density 2.0 g/cm³,
// element area 150 cm² (8 mm sheath, 60 cm long). At 300 ppm that is about 1 mm a year: an
// illustrative calibration, not a measurement.
// Element temperature: the 2 kW element puts out q = 2000 W ÷ 0.015 m² ≈ 133 kW/m². The heat must
// cross the scale: ΔT = q·δ/k with k ≈ 1 W/m·K for porous CaCO₃ scale (reported 0.8–2.9), so every
// millimetre adds about 130 °C. A clean sheath runs about q/h ≈ 27 °C above the water (h ≈ 5,000 W/m²K).
import { THREE, M, swarm, tube, canvasTexture, clamp } from '../kit.js';
import { makeGeyser, makeWater, makeWall, fitView, responsive } from '../geyser.js';

const VIEW = { pos: [1.5, 3.8, 11.2], target: [1.3, 3.0, 0] };
const SC = 1.3, GY = 0.5;
const MG0 = Math.PI * 1.0 * 1.0 * 20 * 1.74;       // g: 2 cm × 20 cm magnesium rod
const MG_PER_AMP_YEAR = (3.156e7 * 24.305) / (2 * 96485);   // g per A·year, 100% efficient
export function anodeModel(ppm, years) {
  const mA = 2 + 0.01 * ppm;
  const perYear = (mA / 1000) * MG_PER_AMP_YEAR / 0.5;
  const left = Math.max(0, MG0 - perYear * years);
  const life = MG0 / perYear;
  return { mA, perYear, left, frac: left / MG0, life, unprotected: Math.max(0, years - life) };
}
export function scaleModel(ppm, years, T = 60) {
  const gPerYear = (ppm * 60 * 365 * 0.005) / 1000;
  const mm = ((gPerYear / 2.0) / 150) * 10 * years;
  const q = 2000 / 0.015;
  const sheath = T + q / 5000 + (q * mm) / 1000 / 1.0;
  return { mm, sheath, perYear: ((gPerYear / 2.0) / 150) * 10 };
}
// Galvanic series in flowing seawater, volts against a saturated calomel electrode
// (after LaQue, "Marine Corrosion" 1975; ASTM G82). Typical mid-range values.
const SERIES = [['Magnesium', -1.6, 0xbfc4c9], ['Zinc', -1.03, 0x9fa8b4], ['Aluminium alloy', -0.8, 0xd6dbe2], ['Mild steel (tank)', -0.61, 0xd07a45], ['Copper', -0.36, 0xd08a55], ['Stainless steel (passive)', -0.08, 0xa8b4c8]];

export default {
  id: 'corrosion',
  short: 'Rust and scale',
  title: 'Rust and scale',
  subtitle: 'A rod that dies so the tank can live, and the stone that grows on a hot element.',
  view: VIEW,
  learn: `<p>Steel and hot water don't get along: the iron slowly <b>rusts</b>. The glass lining protects most of the tank, but there are always tiny flaws. So geysers use a trick from ships and pipelines: a <b>sacrificial anode</b>.</p>
    <p>Different metals hold on to their electrons differently; list them and you get the <b>galvanic series</b>. <b>Magnesium</b> gives up electrons much more readily than steel. Bolt a magnesium rod into the tank and it corrodes instead, sending electrons through the metal to the steel, which stays protected. The rod slowly dissolves, so it must be <b>checked every year or two and replaced</b> when it's worn down. Once it's gone, the tank starts to rust.</p>
    <p>Hard water brings a second problem. It carries dissolved <b>calcium</b>, and heating makes it drop out as <b>calcium carbonate</b>: the chalky <b>scale</b> you see in kettles. It builds up on the hottest surface, the element. Scale conducts heat poorly, so the element has to run hotter and hotter to push its heat through. Nearly all of the heat still ends up in the water, but the element can overheat and <b>burn out</b>. Many Indian cities, like Bengaluru on borewell water, have very hard water.</p>
    <p class="tip"><b>Try it:</b> set your water's hardness and let the years roll by. Watch the anode shrink and the scale grow. Then replace the anode and descale the element.</p>`,
  terms: [
    { t: 'Corrosion', d: 'Metal slowly reacting with water and oxygen; for iron and steel, we call it rust.' },
    { t: 'Sacrificial anode', d: 'A more reactive metal that corrodes on purpose, protecting the metal it is joined to.' },
    { t: 'Galvanic series', d: 'Metals listed by how easily they give up electrons in water. The one higher up corrodes first.' },
    { t: 'Hard water', d: 'Water with lots of dissolved calcium and magnesium, measured in ppm (mg per litre) as calcium carbonate.' },
    { t: 'Scale', d: 'Calcium carbonate that comes out of hard water when it is heated and sticks to hot surfaces.' },
  ],
  defaults: { ppm: 300, years: 1, anodeAt: 0, descaleAt: 0 },
  controls: [
    { key: 'ppm', type: 'range', label: 'Water hardness', min: 20, max: 600, step: 10, ends: ['soft', 'very hard'], fmt: (v) => `${Math.round(v)} ppm · ${v < 60 ? 'soft' : v < 120 ? 'moderate' : v < 180 ? 'hard' : 'very hard'}` },
    { key: 'years', type: 'range', label: 'Years in service', min: 0, max: 10, step: 0.1, fmt: (v) => v.toFixed(1) + ' years' },
    { key: 'care', type: 'buttons', label: 'Maintenance', items: [{ label: 'Replace the anode now', act: (s) => { s.anodeAt = s.years; } }, { label: 'Descale the element', act: (s) => { s.descaleAt = s.years; } }] },
  ],
  onChange(s) { if (s.anodeAt > s.years) s.anodeAt = s.years; if (s.descaleAt > s.years) s.descaleAt = s.years; },
  quiz: [
    { q: 'Why does a geyser have a magnesium rod inside?', options: ['To make the water taste better', 'It corrodes instead of the steel tank, protecting it', 'It heats the water', 'It measures the temperature'], answer: 1, why: 'Magnesium gives up electrons more easily than steel, so it dissolves while the tank stays whole.' },
    { q: 'What happens once the anode is used up?', options: ['Nothing', 'The tank itself starts to rust', 'The water heats faster', 'The thermostat stops working'], answer: 1, why: 'With no more sacrificial metal, the steel at flaws in the lining corrodes and the tank can start to leak.' },
    { q: 'Why is scale bad for an electric element?', options: ['It makes the water cold', 'It traps heat, so the element runs much hotter and can burn out', 'It uses up the anode', 'It changes the voltage'], answer: 1, why: 'Scale is a poor conductor of heat. Each millimetre forces the element to run roughly 130 °C hotter to push the same heat out.' },
  ],
  reel: [
    { ms: 5400, caption: 'A magnesium rod rusts away on purpose, so the steel tank doesn’t.', set: { ppm: 300, anodeAt: 0, descaleAt: 0 }, anim: { years: [0, 3] }, spin: 0.25 },
  ],

  build({ stage }) {
    const root = new THREE.Group(); stage.root.add(root);
    root.add(makeWall(14));
    const pivot = new THREE.Group(); pivot.position.set(-0.3, GY, 0); pivot.scale.setScalar(SC); root.add(pivot);
    const G = makeGeyser(); G.setCut(true); pivot.add(G.group);
    const W = makeWater(16); W.setTemps([60]); W.bands.forEach((b) => { b.material.opacity = 0.28; }); pivot.add(W);
    G.outlet.visible = false; G.pocket.visible = false;
    // Bring the anode and element to the front of the section so they read clearly.
    G.anode.position.z = G.anodeCore.position.z = 0.5;

    // Scale: a chalky shell around the element, rebuilt as it thickens (drawn to scale).
    const scaleMat = new THREE.MeshStandardMaterial({ color: 0xf1ead8, roughness: 1, transparent: true, opacity: 0.92 });
    let scaleMesh = null, scaleKey = -1;
    const setScale = (mm) => {
      const k = Math.round(mm * 20) / 20;
      if (k === scaleKey) return; scaleKey = k;
      if (scaleMesh) { G.inner.remove(scaleMesh); scaleMesh.geometry.dispose(); scaleMesh = null; }
      if (k > 0.02) { scaleMesh = tube(G.elemPath.slice(1, -1), 0.045 + k * 0.01, scaleMat, false, 120); G.inner.add(scaleMesh); }
    };
    // Rust spots on the tank wall once the anode is gone.
    const NR = 60, rust = swarm(NR, new THREE.CircleGeometry(0.08, 12), new THREE.MeshStandardMaterial({ color: 0xa4491d, roughness: 1, side: THREE.DoubleSide }));
    rust.castShadow = false; pivot.add(rust);
    const hash = (x) => { const v = Math.sin(x * 12.9898) * 43758.5453; return v - Math.floor(v); };
    const rs = Array.from({ length: NR }, (_, i) => [Math.PI / 2 + 0.25 + hash(i + 1) * (Math.PI - 0.5), 0.4 + hash(i + 50) * 2.2, 0.5 + hash(i + 90)]);
    // Electrons (anode → steel) and magnesium ions leaving the rod.
    const NE = 36, el = swarm(NE, new THREE.SphereGeometry(0.03, 6, 5), M.glow(0xffd84a));
    el.castShadow = false; pivot.add(el);
    const ePath = [[0.6, 1.0, 0.5], [0.6, 0.12, 0.5], [0.6, 0.06, 0.2], [1.0, 0.1, 0.0], [1.3, 0.5, -0.2], [1.33, 1.2, -0.25]].map((p) => new THREE.Vector3(...p));
    const eCurve = new THREE.CatmullRomCurve3(ePath);
    const NI = 30, ions = swarm(NI, new THREE.SphereGeometry(0.035, 6, 5), M.glow(0xcfd6e0, { transparent: true, opacity: 0.8 }));
    ions.castShadow = false; pivot.add(ions);

    const lA = stage.label('', [0.6, 2.35, 0.5], pivot);
    const lE = stage.label('', [-0.35, 1.8, 0.4], pivot, 'hot');
    const lR = stage.label('Rust', [-1.0, 2.3, -0.6], pivot);

    // Board: the galvanic series.
    const board = canvasTexture(760, 560, (g, w, h) => {
      g.clearRect(0, 0, w, h); g.fillStyle = 'rgba(10,12,18,.9)'; g.fillRect(0, 0, w, h);
      g.font = 'bold 32px sans-serif'; g.fillStyle = '#e8eef8'; g.fillText('The galvanic series (seawater)', 20, 44);
      g.font = '21px sans-serif'; g.fillStyle = 'rgba(255,255,255,.6)'; g.fillText('volts vs a calomel electrode: more negative corrodes first', 20, 76);
      const x0 = 330, x1 = w - 110, X = (v) => x0 + (-v / 1.7) * (x1 - x0);
      SERIES.forEach(([name, v, col], i) => {
        const y = 110 + i * 70;
        g.fillStyle = '#e8eef8'; g.font = '24px sans-serif'; g.fillText(name, 20, y + 34);
        g.fillStyle = '#' + new THREE.Color(col).getHexString(); g.fillRect(x0, y + 10, Math.max(4, X(v) - x0), 34);
        g.fillStyle = '#fff'; g.font = 'bold 22px sans-serif'; g.fillText(v.toFixed(2) + ' V', X(v) + 8, y + 34);
      });
      g.font = '21px sans-serif'; g.fillStyle = '#ffd84a'; g.fillText('Magnesium protects steel: it is 1 V more eager to corrode.', 20, h - 18);
    });
    const bm = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 3.32), new THREE.MeshBasicMaterial({ map: board.tex, transparent: true, toneMapped: false }));
    bm.position.set(4.4, 3.2, -0.2); bm.rotation.y = -0.28; root.add(bm);

    let t = 0;
    const resp = responsive(stage, (p) => (p ? fitView(stage, [0, 4.3, 0], [0.1, 0.15, 1], 14.5) : VIEW), (p) => {
      if (p) { pivot.position.set(0, GY, 0); bm.position.set(0, 7.6, -0.4); bm.rotation.y = 0; } else { pivot.position.set(-0.3, GY, 0); bm.position.set(4.4, 3.2, -0.2); bm.rotation.y = -0.28; }
    });
    return {
      dispose() { stage.setShift(0, 0); },
      update(dt, s) {
        dt = Math.max(0, dt); t += dt;
        resp();
        const a = anodeModel(s.ppm, s.years - s.anodeAt), sc = scaleModel(s.ppm, s.years - s.descaleAt);
        // Anode: shrink its radius with the mass left (length stays), pitting as it goes.
        const r = Math.sqrt(Math.max(0, a.frac));
        G.anode.children[0].scale.set(Math.max(0.001, r), 1, Math.max(0.001, r));
        G.anode.visible = a.frac > 0.01;
        setScale(sc.mm);
        // Rust: grows with the years unprotected. Earlier replacements don't undo old rust.
        const unprot = a.unprotected + (s.anodeAt > 0 ? anodeModel(s.ppm, s.anodeAt).unprotected : 0);
        const nr = Math.min(NR, Math.floor(unprot * 22));
        for (let i = 0; i < NR; i++) {
          const [ph, y, sz] = rs[i], R = 1.33;
          rust.place(i, [R * Math.sin(ph), y, R * Math.cos(ph)], [0, ph, 0], i < nr ? sz * Math.min(1.6, 0.6 + unprot * 0.3) : 0.0001);
        }
        rust.done(); lR.visible = nr > 0;
        // Electrons and ions only while there is magnesium to give.
        const live = a.frac > 0.01;
        el.visible = ions.visible = live;
        if (live) {
          for (let i = 0; i < NE; i++) { const u = (i / NE + t * 0.25) % 1; el.place(i, eCurve.getPointAt(u).toArray()); }
          el.done();
          for (let i = 0; i < NI; i++) {
            const u = (hash(i + 7) + t * 0.2) % 1, ang = hash(i + 3) * Math.PI * 2, yy = 0.3 + hash(i + 11) * 1.7;
            ions.place(i, [0.6 + Math.cos(ang) * (0.1 + u * 0.6), yy + u * 0.3, 0.5 + Math.sin(ang) * (0.1 + u * 0.6)], null, 1 - u);
          }
          ions.done();
        }
        lA.element.innerHTML = live ? `Magnesium anode <b>${Math.round(a.frac * 100)}%</b> left` : 'Anode <b>used up</b>';
        lE.element.innerHTML = `Element <b>${Math.round(sc.sheath)} °C</b>`;
      },
      readout: (s) => {
        const a = anodeModel(s.ppm, s.years - s.anodeAt), sc = scaleModel(s.ppm, s.years - s.descaleAt);
        const burn = sc.sheath > 400;
        return `<div class="big">${a.frac > 0.01 ? 'Tank protected' : '<span class="no">Tank rusting</span>'}</div>
          <div class="row"><span>Anode life at this hardness</span><b>${a.life.toFixed(1)} years</b></div>
          <div class="row"><span>Scale on the element</span><b>${sc.mm.toFixed(1)} mm</b></div>
          <div class="row"><span>Element surface</span><b>${burn ? `<span class="no">${Math.round(sc.sheath)} °C: burnout risk</span>` : Math.round(sc.sheath) + ' °C'}</b></div>
          <small>Scale grows ~${sc.perYear.toFixed(1)} mm a year here. Assumed rates: see the code.</small>`;
      },
    };
  },
};
