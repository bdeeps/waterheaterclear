// Chapter 6: energy and the alternatives. A year of hot water, five ways.
//  Useful heat: L litres a day of 40 °C water from cold at T_in: Q = L·c·(40 − T_in).
//  Electric storage: Q ÷ 0.98 plus the standing loss while switched on. Standing loss comes from the
//    BEE star table (geyser.js), scaled from the 45 K test difference to a 60 °C tank in a 25 °C room.
//  Electric instant: Q ÷ 0.98, no tank to lose heat from.
//  Gas (LPG) instant: Q ÷ 0.80 (a typical conventional instantaneous heater), LPG at 46 MJ/kg and
//    ₹853 for a 14.2 kg domestic cylinder (Delhi, April 2025): about ₹60 per kg.
//  Heat pump: Q ÷ COP, COP 3 averaged over the year (rated 3–4; lower in cold weather).
//  Solar (100 LPD evacuated-tube or flat-plate) with an electric backup: the sun supplies ~75% of the
//    heat over a year in much of India (less in a north Indian winter). State agencies such as MEDA
//    (mahaurja.com) say a 100 LPD system
//    can save up to 1,500 units a year, which matches a full 100 L/day heated by about 35 °C.
import { THREE, M, box, arrow, approach } from '../kit.js';
import { makeGeyser, makeWater, makeWall, standingLoss, uaFrom, C_W, TARIFF, fitView, responsive } from '../geyser.js';

const VIEW = { pos: [-0.6, 4.4, 13.0], target: [-0.6, 3.0, 0] };
const GX = 3.1, GY = 2.2;
const TSET = 60, ROOM = 25, LPG_RS_KG = 853 / 14.2, LPG_MJ = 46, SOLAR = 0.75, COP = 3;
export function yearly({ use = 100, tin = 20, star = 3, size = 15, hours = 24 }) {
  const q = (use * C_W * Math.max(0, 40 - tin)) / 3600;                 // kWh of heat a day
  const Sday = standingLoss(size, star) * ((TSET - ROOM) / 45) * (hours / 24);
  const lossW = uaFrom(standingLoss(size, star)) * (TSET - ROOM);
  const opts = [
    { id: 'storage', name: 'Storage geyser', color: 0xff8a3d, kwh: (q / 0.98 + Sday) * 365, standing: Sday * 365 },
    { id: 'instant', name: 'Instant', color: 0xf5d547, kwh: (q / 0.98) * 365 },
    { id: 'gas', name: 'Gas (LPG)', color: 0x3f8cff, fuelKg: ((q / 0.8) * 3.6 / LPG_MJ) * 365 },
    { id: 'hp', name: 'Heat pump', color: 0x5ce1a9, kwh: (q / COP) * 365 },
    { id: 'solar', name: 'Solar', color: 0xffc24a, kwh: ((q * (1 - SOLAR)) / 0.98) * 365 },
  ];
  opts.forEach((o) => { o.rs = o.fuelKg ? o.fuelKg * LPG_RS_KG : o.kwh * TARIFF; });
  return { q, Sday, lossW, opts };
}

export default {
  id: 'energy',
  short: 'Energy & bills',
  title: 'Energy, stars and cheaper hot water',
  subtitle: 'A hot tank leaks heat all day. Here is what that costs, and the alternatives.',
  view: VIEW,
  learn: `<p>A storage geyser keeps its water hot even when no one is using it, so heat seeps out through the foam all day. That's its <b>standing loss</b>. Heat flows through insulation like water through a sponge: <b>Q = U × A × ΔT</b>. Thicker, better foam (a smaller <b>U</b>), a smaller surface (<b>A</b>) and a lower temperature (<b>ΔT</b>) all cut it. It's the same physics as a fridge's walls (see <a href="/fridgeclear/#insulation">FridgeClear</a>).</p>
    <p>In India, the <b>BEE star label</b> on a storage geyser rates exactly this: the kWh a full tank loses in 24 hours when it's kept 45 °C above the room. A 15 L five-star geyser must lose no more than 0.46 kWh a day; one star allows up to 0.68. Switching the geyser off after your bath saves most of it.</p>
    <p>Two cleverer machines beat any element. A <b>heat pump water heater</b> is an air conditioner run backwards: it pulls heat out of the air and pumps it into the water, giving about <b>3 units of heat for 1 of electricity</b>. A <b>solar water heater</b> on the roof uses black collectors or glass <b>evacuated tubes</b> to soak up sunlight; a typical Indian family system holds <b>100 litres a day</b> and needs electric backup only on cloudy days.</p>
    <p class="tip"><b>Try it:</b> change the star rating and the hours the geyser stays on. Then compare a year of bills for all five ways to heat water.</p>`,
  terms: [
    { t: 'Standing loss', d: 'Heat a full, hot tank loses in a day with no water drawn. BEE measures it in kWh per 24 hours.' },
    { t: 'U-value', d: 'How easily heat passes through a wall or insulation, in watts per square metre per degree.' },
    { t: 'Heat pump', d: 'A machine that moves heat from a cooler place to a warmer one using electricity, like an AC or fridge.' },
    { t: 'Evacuated tube', d: 'A glass tube inside a glass tube with a vacuum between, which traps the sun’s heat like a flask.' },
    { t: 'LPD', d: 'Litres per day: the size of a solar water heater, set by how much hot water a family uses.' },
  ],
  defaults: { use: 100, tin: 20, star: 3, size: 15, hours: 24 },
  controls: [
    { key: 'use', type: 'range', label: 'Hot water a day (at 40 °C)', min: 20, max: 200, step: 10, ends: ['one bath', 'big family'], fmt: (v) => `${Math.round(v)} L · ${(v / 20).toFixed(0)} buckets` },
    { key: 'tin', type: 'range', label: 'Cold water, year average', min: 12, max: 30, step: 1, fmt: (v) => Math.round(v) + ' °C' },
    { key: 'star', type: 'seg', label: 'Geyser star rating', options: [1, 2, 3, 4, 5].map((v) => ({ v, label: v + '★' })), fmt: (v, s) => `${standingLoss(s.size, v).toFixed(2)} kWh/24 h` },
    { key: 'size', type: 'seg', label: 'Geyser size', options: [{ v: 15, label: '15 L' }, { v: 25, label: '25 L' }] },
    { key: 'hours', type: 'range', label: 'Hours switched on a day', min: 1, max: 24, step: 1, ends: ['just for baths', 'always on'], fmt: (v) => Math.round(v) + ' h' },
  ],
  onChange(s) { s.star = Math.round(s.star); },
  quiz: [
    { q: 'What does the BEE star label on a storage geyser measure?', options: ['How fast it heats', 'How much heat a full hot tank loses in 24 hours', 'Its maximum temperature', 'How long it lasts'], answer: 1, why: 'It rates standing loss: kWh lost in a day at a 45 °C difference. More stars, less loss.' },
    { q: 'How can a heat pump give 3 units of heat for 1 unit of electricity?', options: ['It burns the electricity three times', 'It moves heat that already exists in the air into the water', 'It uses solar power at night', 'It breaks the laws of physics'], answer: 1, why: 'Like an AC in reverse, it pumps heat from the surrounding air. The electricity only drives the pump.' },
    { q: 'Which change cuts a storage geyser’s standing loss the most?', options: ['A brighter indicator lamp', 'Switching it off when hot water isn’t needed', 'A longer outlet pipe', 'A bigger element'], answer: 1, why: 'Standing loss only happens while the tank is kept hot. Off, it slowly cools and loses much less.' },
  ],
  reel: [
    { ms: 5600, caption: 'A heat pump or a solar heater makes the same hot water for a fraction of the bill.', set: { use: 100, tin: 20, size: 15, star: 3 }, anim: { hours: [24, 2] }, spin: 0.15 },
  ],

  build({ stage }) {
    const root = new THREE.Group(); stage.root.add(root);
    root.add(makeWall(18));
    const pivot = new THREE.Group(); pivot.position.set(GX, GY, 0); root.add(pivot);
    const G = makeGeyser(); pivot.add(G.group);
    G.shellFront.visible = G.pufFront.visible = G.band.visible = false;          // cut open so the foam shows
    const W = makeWater(8); W.setTemps([TSET]); pivot.add(W);
    // Heat seeping out through the insulation: arrows all round the shell.
    const heat = [];
    for (let i = 0; i < 18; i++) {
      const a = arrow(0xff5a3d, 0.6, 0.2, 0.035), ang = (i % 2 ? 1 : -1) * (Math.PI / 2 + ((i >> 1) % 3 - 1) * 0.3), y = 0.4 + Math.floor(i / 6) * 1.1;
      a.userData = { ang, y }; pivot.add(a); heat.push(a);
    }
    for (let i = 0; i < 3; i++) { const a = arrow(0xff5a3d, 0.6, 0.2, 0.035); a.userData = { top: true, x: (i - 1) * 0.8 }; pivot.add(a); heat.push(a); }
    const lLoss = stage.label('', [0, 4.25, 0.5], pivot, 'hot');

    // A year of bills: one bar per option.
    const bars = [], X0 = -6.0, DX = 1.75, K = 1 / 2000;          // scene units per rupee
    yearly({}).opts.forEach((o, i) => {
      const b = box(0.9, 1, 0.9, M.plastic(o.color, { roughness: 0.4 }));
      b.position.set(X0 + i * DX, 0.5, 0.3); root.add(b);
      const top = stage.label('', [X0 + i * DX, 1.2, 0.8], root);
      const name = stage.label(o.name, [X0 + i * DX, -0.35, 0.9], root);
      bars.push({ b, top, name, h: 1 });
    });
    const standBar = box(0.92, 1, 0.92, M.plastic(0xd12f2f, { roughness: 0.4 })); root.add(standBar);

    let t = 0, x0 = X0, dx = DX;
    const resp = responsive(stage, (p) => (p ? fitView(stage, [0, 4.8, 0], [0, 0.15, 1], 16) : VIEW), (p) => {
      if (p) { pivot.position.set(0, 6.3, 0); x0 = -2.6; dx = 1.3; } else { pivot.position.set(GX, GY, 0); x0 = X0; dx = DX; }
      bars.forEach((B, i) => { B.b.position.x = x0 + i * dx; B.top.position.x = x0 + i * dx; B.name.position.x = x0 + i * dx; B.b.scale.x = B.b.scale.z = p ? 0.85 : 1; });
    });
    return {
      dispose() { stage.setShift(0, 0); },
      update(dt, s) {
        dt = Math.max(0, dt); t += dt;
        resp();
        const y = yearly(s);
        y.opts.forEach((o, i) => {
          const B = bars[i];
          B.h = approach(B.h, Math.max(0.05, o.rs * K), 6, dt);
          B.b.scale.y = B.h; B.b.position.y = B.h / 2;
          B.top.position.y = B.h + 0.35;
          B.top.element.innerHTML = `<b>₹${(Math.round(o.rs / 10) * 10).toLocaleString('en-IN')}</b>`;
        });
        // Red slice at the top of the storage bar: the part lost as standing loss.
        const st = y.opts[0], sh = Math.max(0.001, st.standing * TARIFF * K * (bars[0].h / Math.max(0.05, st.rs * K)));
        standBar.scale.y = sh; standBar.position.set(x0, bars[0].h - sh / 2, 0.3); standBar.scale.x = standBar.scale.z = bars[0].b.scale.x; standBar.visible = sh > 0.01;
        // Heat arrows: longer when the tank leaks more heat.
        const on = s.hours / 24, L = 0.25 + y.lossW * 0.03;
        heat.forEach((a, i) => {
          const ph = (t * 0.6 + i * 0.13) % 1, u = a.userData;
          if (u.top) { a.position.set(u.x, 3.4 + ph * 0.5, 0); a.rotation.set(0, 0, 0); }
          else { const r = 1.85 + ph * 0.5; a.position.set(Math.sin(u.ang) * r, u.y, Math.cos(u.ang) * r); a.rotation.set(0, 0, 0); a.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), u.ang); a.rotateX(Math.PI / 2); }
          a.set(L * (1 - ph * 0.5)); a.visible = a.visible && (i / heat.length) < 0.25 + 0.75 * on;
        });
        lLoss.element.innerHTML = `Heat leaking <b>${y.lossW.toFixed(0)} W</b> while on`;
      },
      readout: (s) => {
        const y = yearly(s), st = y.opts[0], best = y.opts[4];
        return `<div class="big">₹${Math.round(st.rs).toLocaleString('en-IN')} a year</div>
          <div class="row"><span>Electric storage geyser, ${s.size} L ${s.star}★</span><b>${Math.round(st.kwh)} kWh</b></div>
          <div class="row"><span>Of which standing loss</span><b>${Math.round(st.standing)} kWh · ₹${Math.round(st.standing * TARIFF).toLocaleString('en-IN')}</b></div>
          <div class="row"><span>Solar with backup</span><b>₹${Math.round(best.rs).toLocaleString('en-IN')}</b></div>
          <small>₹${TARIFF}/kWh, LPG ₹${Math.round(LPG_RS_KG)}/kg, heat pump COP ${COP}, sun gives ${SOLAR * 100}%.</small>`;
      },
    };
  },
};
