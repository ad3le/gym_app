import {
  store, uid, MUSCLES, MUSCLE_COLORS, KINDS, exById, planById, workoutById, num, estNRM, dayKey,
  startOfWeek, weekNumber, entryDone, lastPerformance, makeSet, makeEntry, startWorkout,
} from './store.js';

const app = document.getElementById('app');
const restEl = document.getElementById('rest');
const st = () => store.state;
const save = () => store.save();

// ---------- helpers ----------

const ICONS = {
  bolt: '<svg viewBox="0 0 24 24"><path d="M13 2L4 14h7l-1 8 9-12h-7z"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  dots: '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.6" class="f"/><circle cx="12" cy="12" r="1.6" class="f"/><circle cx="19" cy="12" r="1.6" class="f"/></svg>',
  wrench: '<svg viewBox="0 0 24 24"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/></svg>',
  timer: '<svg viewBox="0 0 24 24"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M10 2h4"/></svg>',
  back: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
  pencil: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
  up: '<svg viewBox="0 0 24 24"><path d="M6 15l6-6 6 6"/></svg>',
  down: '<svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>',
  gear: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/></svg>',
  share: '<svg viewBox="0 0 24 24"><path d="M12 15V3M7 8l5-5 5 5M5 13v7h14v-7"/></svg>',
};
const icon = (n, cls = '') => `<span class="ic ${cls}">${ICONS[n]}</span>`;

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const go = path => { location.hash = '#' + path; };
const pad = n => String(n).padStart(2, '0');
const fmtNum = x => (isNaN(x) ? '' : String(Math.round(x * 10) / 10));
const WD = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function fmtClock(sec) {
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
const fmtDate = (t, opts = { weekday: 'short', day: 'numeric', month: 'short' }) => new Date(t).toLocaleDateString(undefined, opts);
const durationMin = w => Math.max(1, Math.round(((w.finishedAt || Date.now()) - w.startedAt) / 60000));
const kindOf = ex => ex?.kind || 'weight';
const targetUnit = ex => (kindOf(ex) === 'time' ? 's' : ' reps');

function thumb(ex, { done = false, size = '' } = {}) {
  if (!ex) return '';
  const ini = ex.name.split(/[\s-]+/).filter(w => /[A-Za-z0-9]/.test(w)).slice(0, 2).map(w => w[0].toUpperCase()).join('');
  const check = done ? `<span class="thumb-check">${ICONS.check}</span>` : '';
  return `<span class="thumb ${size}" style="--c:${MUSCLE_COLORS[ex.muscle] || '#8e8e93'}">${esc(ini)}${check}</span>`;
}

function exSubtitle(ex) {
  return [ex.equipment, ex.muscle].filter(Boolean).map(esc).join(' · ');
}

let toastTimer;
function toast(msg) {
  let el = document.getElementById('toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; document.body.appendChild(el); }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
}

// ---------- sheets ----------

function openSheet(html, bind) {
  closeSheet();
  const wrap = document.createElement('div');
  wrap.className = 'sheet-wrap';
  wrap.innerHTML = `<div class="sheet-backdrop"></div><div class="sheet"><div class="grabber"></div>${html}</div>`;
  document.body.appendChild(wrap);
  wrap.querySelector('.sheet-backdrop').onclick = closeSheet;
  requestAnimationFrame(() => wrap.classList.add('open'));
  bind?.(wrap.querySelector('.sheet'));
}
function closeSheet() { document.querySelectorAll('.sheet-wrap').forEach(w => w.remove()); }

function menuSheet(title, items) {
  const html = `${title ? `<h2>${esc(title)}</h2>` : ''}<div class="menu">${items.map((it, i) =>
    `<button class="menu-item ${it.danger ? 'danger' : ''}" data-i="${i}">${esc(it.label)}</button>`).join('')}</div>`;
  openSheet(html, sh => {
    sh.onclick = e => {
      const b = e.target.closest('[data-i]');
      if (!b) return;
      closeSheet();
      items[+b.dataset.i].onClick();
    };
  });
}

function formSheet({ title, fields, submitLabel = 'Save', onSubmit, danger }) {
  const field = f => {
    let input;
    if (f.type === 'select') {
      input = `<select name="${f.name}">${f.options.map(o => {
        const [v, l] = Array.isArray(o) ? o : [o, o];
        return `<option value="${esc(v)}" ${String(v) === String(f.value) ? 'selected' : ''}>${esc(l)}</option>`;
      }).join('')}</select>`;
    } else {
      input = `<input name="${f.name}" type="${f.type || 'text'}" ${f.inputmode ? `inputmode="${f.inputmode}"` : ''}
        ${f.placeholder ? `placeholder="${esc(f.placeholder)}"` : ''} value="${esc(f.value ?? '')}" ${f.required ? 'required' : ''} autocomplete="off">`;
    }
    return `<label class="field"><span>${esc(f.label)}</span>${input}${f.hint ? `<small>${esc(f.hint)}</small>` : ''}</label>`;
  };
  const html = `<h2>${esc(title)}</h2><form class="form">${fields.map(field).join('')}
    <button class="btn blue" type="submit">${esc(submitLabel)}</button>
    ${danger ? `<button class="btn danger" type="button" data-danger>${esc(danger.label)}</button>` : ''}</form>`;
  openSheet(html, sh => {
    const form = sh.querySelector('form');
    form.onsubmit = e => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(form));
      closeSheet();
      onSubmit(data);
    };
    sh.querySelector('[data-danger]')?.addEventListener('click', () => { closeSheet(); danger.onClick(); });
    const first = sh.querySelector('input');
    if (first && first.type !== 'date') setTimeout(() => first.focus(), 60);
  });
}

function exerciseForm(ex, onSaved) {
  const editing = !!ex && !ex.isDraft;
  const used = editing && (st().workouts.some(w => w.entries.some(e => e.exerciseId === ex.id))
    || st().plans.some(p => p.days.some(d => d.items.some(i => i.exerciseId === ex.id))));
  formSheet({
    title: editing ? 'Edit exercise' : 'New exercise',
    fields: [
      { name: 'name', label: 'Name', value: ex?.name, required: true, placeholder: 'e.g. Seated Pike Leg Lifts' },
      { name: 'kind', label: 'Log sets as', type: 'select', value: ex?.kind || 'weight', options: Object.entries(KINDS) },
      { name: 'equipment', label: 'Equipment (optional)', value: ex?.equipment, placeholder: 'e.g. Dumbbells' },
      { name: 'muscle', label: 'Group', type: 'select', value: ex?.muscle || 'Other', options: MUSCLES },
    ],
    onSubmit: d => {
      const name = d.name.trim();
      if (!name) return;
      const target = editing ? ex : { id: uid() };
      Object.assign(target, { name, kind: d.kind, equipment: d.equipment.trim(), muscle: d.muscle });
      if (!editing) st().exercises.push(target);
      save();
      onSaved?.(target);
      render();
    },
    danger: editing && !used ? {
      label: 'Delete exercise',
      onClick: () => {
        if (!confirm(`Delete ${ex.name}?`)) return;
        st().exercises = st().exercises.filter(e => e.id !== ex.id);
        save();
        if (location.hash.startsWith('#/exercise/')) go('/exercises'); else render();
      },
    } : null,
  });
}

function pickExercise(onPick) {
  const list = q => {
    const ql = q.trim().toLowerCase();
    const exs = st().exercises
      .filter(e => !ql || e.name.toLowerCase().includes(ql) || (e.equipment || '').toLowerCase().includes(ql))
      .sort((a, b) => a.name.localeCompare(b.name));
    if (!exs.length) return `<p class="muted pad">No match. Add it as a new exercise.</p>`;
    return exs.map(e => `<button class="list-item" data-ex="${e.id}">${thumb(e, { size: 'sm' })}
      <span class="grow">${esc(e.name)}<small>${exSubtitle(e)}</small></span></button>`).join('');
  };
  const html = `<h2>Add exercise</h2>
    <input class="search" type="search" placeholder="Search" autocomplete="off">
    <button class="btn ghost" data-new>${icon('plus')} New exercise</button>
    <div class="pick-list">${list('')}</div>`;
  openSheet(html, sh => {
    const search = sh.querySelector('.search');
    const listEl = sh.querySelector('.pick-list');
    search.oninput = () => { listEl.innerHTML = list(search.value); };
    sh.onclick = e => {
      if (e.target.closest('[data-new]')) {
        const typed = search.value.trim();
        exerciseForm(typed ? { name: typed, isDraft: true } : null, ex => onPick(ex.id));
        return;
      }
      const b = e.target.closest('[data-ex]');
      if (b) { closeSheet(); onPick(b.dataset.ex); }
    };
  });
}

// ---------- share ----------

function setText(ex, s) {
  const k = kindOf(ex);
  if (k === 'time') return s.sec !== '' ? `${s.sec}s` : '';
  if (k === 'reps') return s.reps !== '' ? `${s.reps}` : '';
  if (s.kg === '' || s.kg == null) return s.reps !== '' ? `${s.reps} reps` : '';
  return `${s.kg} kg × ${s.reps}`;
}

function workoutText(w) {
  const lines = [`${w.name} — ${fmtDate(w.startedAt)} (${durationMin(w)} min)`];
  for (const e of w.entries) {
    const ex = exById(e.exerciseId);
    const sets = e.sets.filter(s => s.done);
    if (!sets.length) continue;
    const warm = sets.filter(s => s.warmup).map(s => setText(ex, s)).filter(Boolean);
    const work = sets.filter(s => !s.warmup).map(s => setText(ex, s)).filter(Boolean);
    const suffix = kindOf(ex) === 'reps' ? ' reps' : '';
    lines.push(`• ${ex?.name ?? 'Exercise'}${ex?.equipment ? ` (${ex.equipment})` : ''}`);
    if (warm.length) lines.push(`   warm-up: ${warm.join(', ')}${suffix}`);
    if (work.length) lines.push(`   ${work.join(', ')}${suffix}`);
  }
  return lines.join('\n');
}

async function shareText(title, text) {
  try {
    if (navigator.share) { await navigator.share({ title, text }); return; }
  } catch (e) {
    if (e.name === 'AbortError') return;
  }
  try {
    await navigator.clipboard.writeText(text);
    toast('Copied to clipboard');
  } catch {
    openSheet(`<h2>${esc(title)}</h2><textarea class="share-text" readonly>${esc(text)}</textarea>`,
      sh => sh.querySelector('textarea').select());
  }
}

function shareHistory() {
  menuSheet('Share with your trainer', [7, 14, 28, 56].map(days => ({
    label: days === 7 ? 'Last week' : `Last ${days / 7} weeks`,
    onClick: () => {
      const from = Date.now() - days * 864e5;
      const ws = finishedWorkouts().filter(w => w.startedAt >= from).reverse();
      if (!ws.length) { toast('No workouts in that period'); return; }
      shareText('Workouts', `${ws.length} workouts\n\n${ws.map(workoutText).join('\n\n')}`);
    },
  })));
}

const finishedWorkouts = () => st().workouts.filter(w => w.finishedAt).sort((a, b) => b.startedAt - a.startedAt);

// ---------- rest timer ----------

let actx;
function ensureAudio() {
  try {
    actx ??= new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
  } catch { /* no audio */ }
}
function beep() {
  if (!actx) return;
  [0, 0.25, 0.5].forEach(t => {
    const o = actx.createOscillator(), g = actx.createGain();
    o.frequency.value = 880;
    o.connect(g); g.connect(actx.destination);
    const t0 = actx.currentTime + t;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.3, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
    o.start(t0); o.stop(t0 + 0.2);
  });
}

function startRest(sec = st().settings.restSeconds) {
  ensureAudio();
  st().restEnd = Date.now() + sec * 1000;
  save();
  tick();
}

function openRestSheet() {
  const html = `<h2>Rest</h2><div class="rest-big" data-rest-big></div>
    <div class="btn-row"><button class="btn" data-r="-15">−15s</button><button class="btn" data-r="15">+15s</button></div>
    <button class="btn blue" data-r="skip">Skip rest</button>`;
  openSheet(html, sh => {
    sh.onclick = e => {
      const r = e.target.closest('[data-r]')?.dataset.r;
      if (!r) return;
      if (r === 'skip') { st().restEnd = null; closeSheet(); }
      else st().restEnd = Math.max(Date.now() + 1000, (st().restEnd || Date.now()) + +r * 1000);
      save();
      tick();
    };
  });
  tick();
}

let currentRoute = [];
function tick() {
  const now = Date.now();
  document.querySelectorAll('[data-elapsed]').forEach(el => { el.textContent = fmtClock((now - +el.dataset.elapsed) / 1000); });
  const s = st();
  if (s.restEnd && s.restEnd <= now) {
    s.restEnd = null;
    save();
    navigator.vibrate?.([300, 120, 300]);
    beep();
    document.querySelector('[data-rest-big]')?.closest('.sheet-wrap')?.remove();
  }
  const w = currentRoute[0] === 'workout' && workoutById(currentRoute[1]);
  const inWorkout = w && !w.finishedAt;
  if (s.restEnd) {
    const left = Math.ceil((s.restEnd - now) / 1000);
    restEl.hidden = false;
    restEl.className = 'rest-btn running';
    restEl.innerHTML = `${ICONS.timer}<span>${fmtClock(left)}</span>`;
    const big = document.querySelector('[data-rest-big]');
    if (big) big.textContent = fmtClock(left);
  } else if (inWorkout) {
    restEl.hidden = false;
    restEl.className = 'rest-btn idle';
    restEl.innerHTML = `${ICONS.timer}<span>${fmtClock(s.settings.restSeconds)}</span>`;
  } else {
    restEl.hidden = true;
  }
}
restEl.onclick = () => (st().restEnd ? openRestSheet() : startRest());
setInterval(tick, 500);
document.addEventListener('visibilitychange', tick);

// ---------- views ----------

function topbar(left, center, right) {
  return `<header class="topbar"><div class="tb-l">${left || ''}</div><div class="tb-c">${center || ''}</div><div class="tb-r">${right || ''}</div></header>`;
}
const backBtn = (href = '#/') => `<a class="iconbtn" href="${href}" aria-label="Back">${icon('back')}</a>`;

function viewHome() {
  const s = st();
  const plan = planById(s.activePlanId);
  const active = workoutById(s.activeWorkoutId);
  const today = new Date();
  const ws = startOfWeek(today);
  const byDay = {};
  for (const w of s.workouts) (byDay[dayKey(w.startedAt)] ||= []).push(w);

  const strip = [...Array(7)].map((_, i) => {
    const d = new Date(ws.getFullYear(), ws.getMonth(), ws.getDate() + i);
    const k = dayKey(d);
    const list = byDay[k] || [];
    const dot = list.some(w => !w.finishedAt) ? 'blue' : list.length ? 'green' : '';
    return `<button class="wday ${k === dayKey(today) ? 'today' : ''}" data-act="day" data-key="${k}">
      <span>${WD[d.getDay()]}</span><b>${d.getDate()}</b><i class="dot ${dot}"></i></button>`;
  }).join('');

  let planHtml;
  if (plan) {
    planHtml = `<div class="plan-head">
        <a class="h1 link" href="#/plan/${plan.id}">${esc(plan.name)}</a>
        <a class="pill-btn" href="#/plan/${plan.id}" aria-label="Edit routine">${icon('dots')}</a>
        <span class="grow"></span><span class="link week">Week ${weekNumber(plan)}</span>
      </div>
      ${plan.days.map((d, i) => dayCard(plan, d, i)).join('') || '<p class="muted">This routine has no days yet.</p>'}`;
  } else {
    planHtml = `<div class="card empty">
      <p><b>Set up your routine</b></p>
      <p class="muted">Add your training days and the exercises you do on each one. Then tap a day to start logging.</p>
      <button class="btn blue" data-act="create">${icon('plus')} Create routine</button></div>`;
  }

  const html = `
    ${topbar(`<a class="iconbtn" href="#/settings" aria-label="Settings">${icon('gear')}</a>`, '', `<button class="link" data-act="create">Create</button>`)}
    <div class="week-strip">${strip}</div>
    ${planHtml}
    <nav class="links">
      <a class="link" href="#/plans">All routines</a>
      <a class="link" href="#/exercises">Exercises</a>
      <a class="link" href="#/history">History</a>
      ${active ? '' : '<button class="link" data-act="quick">Start empty workout</button>'}
    </nav>
    ${active ? `<a class="active-bar" href="#/workout/${active.id}">${icon('bolt')} ${esc(active.name)} · <span data-elapsed="${active.startedAt}"></span> min</a>` : ''}`;

  const actions = {
    create: () => createPlan(),
    quick: () => { const w = startWorkout(null, null); go('/workout/' + w.id); },
    'open-day': t => openDaySheet(plan, plan.days.find(d => d.id === t.dataset.day)),
    day: t => {
      const list = (byDay[t.dataset.key] || []).sort((a, b) => a.startedAt - b.startedAt);
      if (!list.length) return;
      if (list.length === 1) { go('/workout/' + list[0].id); return; }
      menuSheet(fmtDate(list[0].startedAt, { weekday: 'long', day: 'numeric', month: 'long' }),
        list.map(w => ({ label: `${w.name}${w.finishedAt ? '' : ' (in progress)'}`, onClick: () => go('/workout/' + w.id) })));
    },
  };
  return { html, actions };
}

function dayCard(plan, day, idx) {
  const s = st();
  const active = workoutById(s.activeWorkoutId);
  const isActive = active && active.dayId === day.id;
  const weekStart = +startOfWeek();
  const doneThisWeek = s.workouts.some(w => w.finishedAt && w.dayId === day.id && w.startedAt >= weekStart);
  const status = isActive ? `<span class="status blue">${ICONS.bolt}</span>`
    : doneThisWeek ? `<span class="status green">${ICONS.check}</span>`
      : `<span class="status">${idx + 1}</span>`;
  const thumbs = day.items.slice(0, 3).map(it => {
    const done = isActive ? entryDone(active.entries.find(e => e.exerciseId === it.exerciseId)) : doneThisWeek;
    return thumb(exById(it.exerciseId), { done, size: 'sm' });
  }).join('');
  const more = day.items.length > 3 ? `<span class="more">+${day.items.length - 3}</span>` : '';
  return `<button class="card day-card" data-act="open-day" data-day="${day.id}">${status}
    <span class="day-name">${esc(day.name)}</span>${thumbs ? `<span class="thumbs">${thumbs}${more}</span>` : ''}</button>`;
}

function openDaySheet(plan, day) {
  if (!day) return;
  const active = workoutById(st().activeWorkoutId);
  const items = day.items.map(it => {
    const ex = exById(it.exerciseId);
    const tgt = it.target !== '' && it.target != null ? ` × ${it.target}${targetUnit(ex)}` : '';
    return `<li class="list-item">${thumb(ex, { size: 'sm' })}<span class="grow">${esc(ex?.name)}<small>${ex ? exSubtitle(ex) : ''}</small></span>
      <span class="muted">${it.sets} sets${tgt}</span></li>`;
  }).join('') || '<p class="muted pad">No exercises yet.</p>';
  let primary;
  if (active && active.dayId === day.id) primary = `<button class="btn blue" data-s="continue">${icon('bolt')} Continue workout</button>`;
  else if (active) primary = `<p class="muted small pad">You have a workout in progress. Finish it before starting another.</p><button class="btn" data-s="continue">Open current workout</button>`;
  else primary = `<button class="btn blue" data-s="start">${icon('bolt')} Start workout</button>`;
  openSheet(`<h2>${esc(day.name)}</h2><ul class="plain">${items}</ul>${primary}<button class="btn ghost" data-s="edit">Edit routine</button>`, sh => {
    sh.onclick = e => {
      const a = e.target.closest('[data-s]')?.dataset.s;
      if (!a) return;
      closeSheet();
      if (a === 'start') { const w = startWorkout(plan, day); go('/workout/' + w.id); }
      else if (a === 'continue') go('/workout/' + active.id);
      else if (a === 'edit') go('/plan/' + plan.id);
    };
  });
}

function createPlan() {
  const plan = { id: uid(), name: 'My routine', createdAt: Date.now(), days: [{ id: uid(), name: 'Day 1', items: [] }] };
  st().plans.push(plan);
  st().activePlanId = plan.id;
  save();
  go('/plan/' + plan.id);
}

// ----- workout -----

const curEx = new Map();

function viewWorkout(id) {
  const s = st();
  const w = workoutById(id);
  if (!w) { go('/'); return null; }
  const isActive = !w.finishedAt;
  let i = curEx.has(id) ? curEx.get(id) : Math.max(0, w.entries.findIndex(e => !entryDone(e)));
  i = Math.min(Math.max(0, i), Math.max(0, w.entries.length - 1));
  curEx.set(id, i);
  const entry = w.entries[i];
  const ex = entry && exById(entry.exerciseId);

  const chips = w.entries.map((e, j) => `<button class="chip ${j === i ? 'sel' : ''}" data-act="sel" data-i="${j}">
    ${thumb(exById(e.exerciseId), { done: entryDone(e) })}</button>`).join('')
    + `<button class="chip add" data-act="add-ex" aria-label="Add exercise">${icon('plus')}</button>`;

  const right = isActive
    ? `<button class="link strong" data-act="finish">Finish</button>`
    : `<button class="iconbtn" data-act="wmenu" aria-label="Workout options">${icon('dots')}</button>`;
  const head = topbar(backBtn(isActive ? '#/' : '#/history'),
    `<button class="link" data-act="rename">${esc(w.name)} ${icon('pencil', 'sm')}</button>`, right);
  const sub = isActive
    ? `<p class="muted center small"><span data-elapsed="${w.startedAt}"></span> elapsed</p>`
    : `<p class="muted center small">${fmtDate(w.startedAt, { weekday: 'long', day: 'numeric', month: 'long' })} · ${durationMin(w)} min</p>`;

  let body;
  if (!entry) {
    body = `<div class="card empty"><p class="muted">No exercises in this workout yet.</p>
      <button class="btn blue" data-act="add-ex">${icon('plus')} Add exercise</button></div>`;
  } else {
    body = exercisePanel(w, entry, ex);
  }

  const html = `${head}${sub}<div class="chips">${chips}</div>${body}<div class="spacer"></div>`;

  const set = t => entry.sets[+t.dataset.k];
  const actions = {
    sel: t => { curEx.set(id, +t.dataset.i); render(); },
    'add-ex': () => pickExercise(exId => {
      w.entries.push(makeEntry(exId, { sets: 3 }, isActive ? Date.now() : w.startedAt));
      curEx.set(id, w.entries.length - 1);
      save(); render();
    }),
    rename: () => formSheet({
      title: 'Workout name', fields: [{ name: 'name', label: 'Name', value: w.name, required: true }],
      onSubmit: d => { w.name = d.name.trim() || w.name; save(); render(); },
    }),
    finish: () => finishFlow(w),
    wmenu: () => menuSheet(w.name, [
      { label: 'Share this workout', onClick: () => shareText(w.name, workoutText(w)) },
      { label: 'Change date', onClick: () => changeDate(w) },
      { label: 'Delete workout', danger: true, onClick: () => deleteWorkout(w) },
    ]),
    'ex-menu': () => menuSheet(ex?.name, [
      { label: 'Replace exercise', onClick: () => pickExercise(exId => {
        const fresh = makeEntry(exId, { sets: entry.sets.filter(x => !x.warmup).length || 3 }, w.startedAt);
        w.entries[i] = fresh; save(); render();
      }) },
      ...(i > 0 ? [{ label: 'Move earlier', onClick: () => { w.entries.splice(i - 1, 0, w.entries.splice(i, 1)[0]); curEx.set(id, i - 1); save(); render(); } }] : []),
      ...(i < w.entries.length - 1 ? [{ label: 'Move later', onClick: () => { w.entries.splice(i + 1, 0, w.entries.splice(i, 1)[0]); curEx.set(id, i + 1); save(); render(); } }] : []),
      { label: 'Exercise history', onClick: () => go('/exercise/' + entry.exerciseId) },
      { label: 'Edit exercise', onClick: () => exerciseForm(ex) },
      { label: 'Remove from workout', danger: true, onClick: () => { w.entries.splice(i, 1); save(); render(); } },
    ]),
    target: () => formSheet({
      title: kindOf(ex) === 'time' ? 'Target time (seconds)' : 'Target reps',
      fields: [{ name: 't', label: kindOf(ex) === 'time' ? 'Seconds' : 'Reps', type: 'number', inputmode: 'numeric', value: entry.target }],
      onSubmit: d => { entry.target = d.t === '' ? '' : +d.t; save(); render(); },
    }),
    'add-warm': () => {
      const at = entry.sets.filter(x => x.warmup).length;
      entry.sets.splice(at, 0, makeSet({ warmup: true }));
      save(); render();
    },
    'add-set': () => {
      const last = [...entry.sets].reverse().find(x => !x.warmup);
      entry.sets.push(makeSet({ kg: last?.kg ?? '', reps: last?.reps ?? (kindOf(ex) !== 'time' ? entry.target : ''), sec: last?.sec ?? (kindOf(ex) === 'time' ? entry.target : '') }));
      save(); render();
    },
    'set-menu': t => {
      const k = +t.dataset.k, x = entry.sets[k];
      menuSheet(x.warmup ? 'Warm-up set' : `Set`, [
        { label: x.warmup ? 'Make it a working set' : 'Make it a warm-up set', onClick: () => {
          x.warmup = !x.warmup;
          entry.sets.sort((a, b) => (b.warmup ? 1 : 0) - (a.warmup ? 1 : 0));
          save(); render();
        } },
        { label: 'Duplicate set', onClick: () => { entry.sets.splice(k + 1, 0, makeSet({ ...x, id: uid(), done: false })); save(); render(); } },
        { label: 'Delete set', danger: true, onClick: () => { entry.sets.splice(k, 1); save(); render(); } },
      ]);
    },
    check: t => {
      const x = set(t);
      if (!x) return;
      const row = t.closest('.set-row');
      if (!x.done) {
        // Fill blanks from the placeholder (last time's values) so one tap logs it.
        row.querySelectorAll('input[data-f]').forEach(inp => {
          if (inp.value === '' && inp.placeholder !== '') x[inp.dataset.f] = num(inp.placeholder);
        });
        x.done = true;
        if (isActive) startRest();
        navigator.vibrate?.(15);
      } else {
        x.done = false;
      }
      save(); render();
    },
  };

  const onInput = t => {
    if (!t.dataset.f || !entry) return;
    const x = entry.sets[+t.dataset.k];
    const v = t.value.replace(',', '.').trim();
    x[t.dataset.f] = v === '' ? '' : (isNaN(+v) ? x[t.dataset.f] : +v);
    save();
    const estEl = app.querySelector(`[data-est="${t.dataset.k}"]`);
    if (estEl) estEl.textContent = x.warmup ? '' : fmtNum(estNRM(x.kg, x.reps, repTarget(entry)));
  };

  return { html, actions, onInput };
}

const repTarget = entry => (num(entry.target) > 0 ? num(entry.target) : 10);

function exercisePanel(w, entry, ex) {
  const kind = kindOf(ex);
  const n = repTarget(entry);
  const prev = lastPerformance(entry.exerciseId, w.startedAt, w.id);
  const prevWork = prev ? prev.entry.sets.filter(x => x.done && !x.warmup) : [];
  const warmCount = entry.sets.filter(x => x.warmup).length;

  const cols = kind === 'weight' ? ['KG', 'REPS', `${n}RM`] : kind === 'reps' ? ['REPS'] : ['SECONDS'];
  const fields = kind === 'weight' ? ['kg', 'reps'] : kind === 'reps' ? ['reps'] : ['sec'];

  let wn = 0;
  const rows = entry.sets.map((x, k) => {
    const label = x.warmup ? 'W' : String(++wn);
    const ph = x.warmup ? {} : (prevWork[wn - 1] || {});
    const inputs = fields.map(f => `<input class="cell in" inputmode="decimal" data-k="${k}" data-f="${f}"
      value="${esc(x[f])}" placeholder="${esc(ph[f] ?? (f !== 'kg' ? entry.target : ''))}" aria-label="${f}">`).join('');
    const est = kind === 'weight' ? `<span class="cell est" data-est="${k}">${x.warmup ? '' : fmtNum(estNRM(x.kg, x.reps, n))}</span>` : '';
    return `<div class="set-row cols-${fields.length} ${x.done ? 'done' : ''} ${x.warmup ? 'warm' : ''}">
      <button class="cell num" data-act="set-menu" data-k="${k}">${label}</button>${inputs}${est}
      <button class="cell check ${x.done ? 'on' : ''}" data-act="check" data-k="${k}" aria-label="Done">${ICONS.check}</button></div>`;
  }).join('');

  const tgt = entry.target !== '' && entry.target != null ? `${entry.target}${targetUnit(ex)}` : (kind === 'time' ? 'Set time' : 'Set reps');

  let prevCard = '';
  if (prev) {
    const sets = prev.entry.sets.filter(x => x.done);
    let pn = 0;
    prevCard = `<div class="card prev">
      <div class="prev-head">${WEEKDAY[new Date(prev.workout.startedAt).getDay()]} · ${esc(prev.workout.name)}
        <span class="muted">${fmtDate(prev.workout.startedAt, { day: 'numeric', month: 'short' })}</span></div>
      <div class="mini cols-${fields.length}"><span>#</span>${cols.map(c => `<span>${c}</span>`).join('')}
        ${sets.map(x => `<span>${x.warmup ? 'W' : ++pn}</span>${fields.map(f => `<span>${esc(x[f])}</span>`).join('')}${kind === 'weight' ? `<span>${x.warmup ? '' : fmtNum(estNRM(x.kg, x.reps, n))}</span>` : ''}`).join('')}
      </div></div>`;
  }

  return `
    <div class="ex-head">
      <h1 class="h1 blue">${esc(ex?.name ?? 'Deleted exercise')}</h1>
      <button class="pill-btn" data-act="ex-menu" aria-label="Exercise options">${icon('dots')}</button>
    </div>
    <div class="ex-sub">${ex?.equipment ? `<span>${esc(ex.equipment)}</span>` : ''}
      <button class="muted-btn" data-act="target">${esc(tgt)} ${icon('pencil', 'sm')}</button></div>
    <button class="pill" data-act="add-warm">${warmCount ? `${warmCount} warm-up set${warmCount > 1 ? 's' : ''} +` : '+ Warm-up set'}</button>
    <div class="set-head cols-${fields.length}"><span>#</span>${cols.map(c => `<span>${c}</span>`).join('')}<span></span></div>
    ${rows}
    <button class="pill add-set" data-act="add-set">${icon('plus')} Add set</button>
    ${prevCard}`;
}

function finishFlow(w) {
  const sets = w.entries.flatMap(e => e.sets);
  const unchecked = sets.filter(x => !x.done).length;
  const done = sets.length - unchecked;
  const finish = mode => {
    if (mode === 'mark') sets.forEach(x => { if (x.kg !== '' || x.reps !== '' || x.sec !== '') x.done = true; });
    for (const e of w.entries) e.sets = e.sets.filter(x => x.done);
    w.entries = w.entries.filter(e => e.sets.length);
    w.finishedAt = Date.now();
    st().activeWorkoutId = null;
    st().restEnd = null;
    save();
    curEx.delete(w.id);
    go('/');
    toast(`Workout saved · ${durationMin(w)} min`);
  };
  if (!unchecked) { finish('discard'); return; }
  const items = [
    { label: `Count all ${sets.length} sets as done & finish`, onClick: () => finish('mark') },
    { label: done ? `Finish with the ${done} checked sets` : 'Discard this workout', danger: !done, onClick: () => (done ? finish('discard') : deleteWorkout(w)) },
    { label: 'Keep training', onClick: () => {} },
  ];
  menuSheet(`${unchecked} set${unchecked > 1 ? 's are' : ' is'} not checked off`, items);
}

function changeDate(w) {
  formSheet({
    title: 'Change date',
    fields: [{ name: 'date', label: 'Date', type: 'date', value: dayKey(w.startedAt) }],
    onSubmit: d => {
      if (!d.date) return;
      const [y, m, dd] = d.date.split('-').map(Number);
      const old = new Date(w.startedAt);
      const start = new Date(y, m - 1, dd, old.getHours(), old.getMinutes()).getTime();
      const len = (w.finishedAt || Date.now()) - w.startedAt;
      w.startedAt = start;
      if (w.finishedAt) w.finishedAt = start + len;
      save(); render();
    },
  });
}

function deleteWorkout(w) {
  if (!confirm(`Delete ${w.name}? This can't be undone.`)) return;
  st().workouts = st().workouts.filter(x => x.id !== w.id);
  if (st().activeWorkoutId === w.id) { st().activeWorkoutId = null; st().restEnd = null; }
  save();
  go(w.finishedAt ? '/history' : '/');
}

// ----- routines -----

function viewPlans() {
  const s = st();
  const cards = s.plans.map(p => `<button class="card plan-card" data-act="plan" data-id="${p.id}">
      <span class="grow"><b>${esc(p.name)}</b><small class="muted">${p.days.length} day${p.days.length === 1 ? '' : 's'}</small></span>
      ${p.id === s.activePlanId ? '<span class="badge">Active</span>' : ''}</button>`).join('')
    || '<p class="muted pad">No routines yet.</p>';
  const html = `${topbar(backBtn(), '<b>Routines</b>', '<button class="link" data-act="create">New</button>')}${cards}`;
  const actions = {
    create: () => createPlan(),
    plan: t => {
      const p = planById(t.dataset.id);
      menuSheet(p.name, [
        ...(p.id !== s.activePlanId ? [{ label: 'Use this routine', onClick: () => { s.activePlanId = p.id; save(); go('/'); } }] : []),
        { label: 'Edit', onClick: () => go('/plan/' + p.id) },
        { label: 'Duplicate', onClick: () => {
          const copy = JSON.parse(JSON.stringify(p));
          copy.id = uid(); copy.name = p.name + ' (copy)'; copy.createdAt = Date.now();
          copy.days.forEach(d => { d.id = uid(); d.items.forEach(it => { it.id = uid(); }); });
          s.plans.push(copy); save(); render();
        } },
        { label: 'Delete', danger: true, onClick: () => deletePlan(p) },
      ]);
    },
  };
  return { html, actions };
}

function deletePlan(p) {
  if (!confirm(`Delete routine "${p.name}"? Logged workouts are kept.`)) return;
  const s = st();
  s.plans = s.plans.filter(x => x.id !== p.id);
  if (s.activePlanId === p.id) s.activePlanId = s.plans[0]?.id ?? null;
  save();
  go('/plans');
}

function viewPlan(id) {
  const s = st();
  const p = planById(id);
  if (!p) { go('/plans'); return null; }
  const days = p.days.map((d, di) => `
    <section class="card day-edit">
      <div class="row"><input class="title-in" data-f="day" data-d="${di}" value="${esc(d.name)}" aria-label="Day name">
        <button class="iconbtn" data-act="day-menu" data-d="${di}" aria-label="Day options">${icon('dots')}</button></div>
      ${d.items.map((it, ii) => {
        const ex = exById(it.exerciseId);
        return `<div class="item-row">${thumb(ex, { size: 'sm' })}
          <span class="grow name">${esc(ex?.name ?? 'Deleted exercise')}<small>${ex ? exSubtitle(ex) : ''}</small></span>
          <button class="iconbtn sm" data-act="item-menu" data-d="${di}" data-i="${ii}" aria-label="Options">${icon('dots')}</button>
        </div>
        <div class="item-fields">
          <label>Sets<input inputmode="numeric" data-f="sets" data-d="${di}" data-i="${ii}" value="${esc(it.sets)}"></label>
          <label>${kindOf(ex) === 'time' ? 'Seconds' : 'Reps'}<input inputmode="numeric" data-f="target" data-d="${di}" data-i="${ii}" value="${esc(it.target)}" placeholder="—"></label>
          <label>Warm-ups<input inputmode="numeric" data-f="warmups" data-d="${di}" data-i="${ii}" value="${esc(it.warmups || 0)}"></label>
        </div>`;
      }).join('')}
      <button class="pill" data-act="add-item" data-d="${di}">${icon('plus')} Add exercise</button>
    </section>`).join('');

  const html = `${topbar(backBtn(), '<b>Edit routine</b>', `<a class="link strong" href="#/">Done</a>`)}
    <label class="field big"><span>Routine name</span><input data-f="name" value="${esc(p.name)}"></label>
    ${days}
    <button class="btn" data-act="add-day">${icon('plus')} Add day</button>
    ${p.id !== s.activePlanId ? '<button class="btn ghost" data-act="use">Use this routine</button>' : ''}
    <button class="btn danger ghost" data-act="del">Delete routine</button>
    <div class="spacer"></div>`;

  const actions = {
    'add-day': () => { p.days.push({ id: uid(), name: `Day ${p.days.length + 1}`, items: [] }); save(); render(); },
    'add-item': t => pickExercise(exId => {
      p.days[+t.dataset.d].items.push({ id: uid(), exerciseId: exId, sets: 3, target: kindOf(exById(exId)) === 'time' ? 30 : 10, warmups: 0 });
      save(); render();
    }),
    'day-menu': t => {
      const di = +t.dataset.d;
      menuSheet(p.days[di].name, [
        ...(di > 0 ? [{ label: 'Move up', onClick: () => { p.days.splice(di - 1, 0, p.days.splice(di, 1)[0]); save(); render(); } }] : []),
        ...(di < p.days.length - 1 ? [{ label: 'Move down', onClick: () => { p.days.splice(di + 1, 0, p.days.splice(di, 1)[0]); save(); render(); } }] : []),
        { label: 'Delete day', danger: true, onClick: () => { if (confirm(`Delete ${p.days[di].name}?`)) { p.days.splice(di, 1); save(); render(); } } },
      ]);
    },
    'item-menu': t => {
      const items = p.days[+t.dataset.d].items, ii = +t.dataset.i;
      menuSheet(exById(items[ii].exerciseId)?.name, [
        ...(ii > 0 ? [{ label: 'Move up', onClick: () => { items.splice(ii - 1, 0, items.splice(ii, 1)[0]); save(); render(); } }] : []),
        ...(ii < items.length - 1 ? [{ label: 'Move down', onClick: () => { items.splice(ii + 1, 0, items.splice(ii, 1)[0]); save(); render(); } }] : []),
        { label: 'Replace exercise', onClick: () => pickExercise(exId => { items[ii].exerciseId = exId; save(); render(); }) },
        { label: 'Remove', danger: true, onClick: () => { items.splice(ii, 1); save(); render(); } },
      ]);
    },
    use: () => { s.activePlanId = p.id; save(); go('/'); },
    del: () => deletePlan(p),
  };

  const onInput = t => {
    const f = t.dataset.f;
    if (f === 'name') p.name = t.value;
    else if (f === 'day') p.days[+t.dataset.d].name = t.value;
    else if (f) {
      const it = p.days[+t.dataset.d].items[+t.dataset.i];
      const v = t.value.trim();
      it[f] = v === '' ? (f === 'target' ? '' : 0) : (isNaN(+v) ? it[f] : Math.max(0, Math.round(+v)));
    }
    save();
  };
  return { html, actions, onInput };
}

// ----- exercises -----

function viewExercises() {
  const exs = [...st().exercises].sort((a, b) => a.name.localeCompare(b.name));
  const groups = MUSCLES.map(m => [m, exs.filter(e => (e.muscle || 'Other') === m)]).filter(([, l]) => l.length);
  const html = `${topbar(backBtn(), '<b>Exercises</b>', '<button class="link" data-act="add">Add</button>')}
    <input class="search" type="search" placeholder="Search exercises" data-search autocomplete="off">
    ${groups.map(([m, l]) => `<h3 class="group">${esc(m)}</h3>
      ${l.map(e => `<a class="list-item" href="#/exercise/${e.id}" data-name="${esc(e.name.toLowerCase())}">${thumb(e, { size: 'sm' })}
        <span class="grow">${esc(e.name)}<small>${exSubtitle(e)}</small></span><span class="muted small">${esc(KINDS[kindOf(e)])}</span></a>`).join('')}`).join('')}
    <div class="spacer"></div>`;
  const actions = { add: () => exerciseForm(null) };
  const onInput = t => {
    if (!t.hasAttribute('data-search')) return;
    const q = t.value.trim().toLowerCase();
    app.querySelectorAll('[data-name]').forEach(el => { el.hidden = q && !el.dataset.name.includes(q); });
    app.querySelectorAll('h3.group').forEach(h => {
      let el = h.nextElementSibling, any = false;
      while (el && el.matches('[data-name]')) { if (!el.hidden) any = true; el = el.nextElementSibling; }
      h.hidden = !any;
    });
  };
  return { html, actions, onInput };
}

function viewExercise(id) {
  const ex = exById(id);
  if (!ex) { go('/exercises'); return null; }
  const rows = finishedWorkouts()
    .map(w => ({ w, sets: w.entries.filter(e => e.exerciseId === id).flatMap(e => e.sets.filter(x => x.done)) }))
    .filter(r => r.sets.length);
  const suffix = kindOf(ex) === 'reps' ? ' reps' : '';
  const html = `${topbar(backBtn('#/exercises'), '', '<button class="link" data-act="edit">Edit</button>')}
    <h1 class="h1 blue">${esc(ex.name)}</h1>
    <p class="muted">${exSubtitle(ex) || '&nbsp;'} · ${esc(KINDS[kindOf(ex)])}</p>
    ${rows.length ? rows.map(({ w, sets }) => `<a class="card hist" href="#/workout/${w.id}">
        <div class="prev-head">${fmtDate(w.startedAt)} · ${esc(w.name)}</div>
        <div>${sets.map(x => `<span class="${x.warmup ? 'muted' : ''}">${esc(setText(ex, x))}</span>`).join(', ')}${suffix}</div></a>`).join('')
      : '<p class="muted pad">Not logged yet.</p>'}
    <div class="spacer"></div>`;
  return { html, actions: { edit: () => exerciseForm(ex) } };
}

// ----- history -----

function viewHistory() {
  const ws = finishedWorkouts();
  let lastMonth = '';
  const items = ws.map(w => {
    const month = fmtDate(w.startedAt, { month: 'long', year: 'numeric' });
    const header = month !== lastMonth ? `<h3 class="group">${esc(month)}</h3>` : '';
    lastMonth = month;
    const nSets = w.entries.reduce((a, e) => a + e.sets.filter(x => x.done && !x.warmup).length, 0);
    const thumbs = w.entries.slice(0, 3).map(e => thumb(exById(e.exerciseId), { size: 'sm' })).join('');
    return `${header}<a class="card hist-card" href="#/workout/${w.id}">
      <span class="grow"><b>${esc(w.name)}</b><small class="muted">${fmtDate(w.startedAt)} · ${durationMin(w)} min · ${nSets} set${nSets === 1 ? '' : 's'}</small></span>
      <span class="thumbs">${thumbs}${w.entries.length > 3 ? `<span class="more">+${w.entries.length - 3}</span>` : ''}</span></a>`;
  }).join('');
  const html = `${topbar(backBtn(), '<b>History</b>', ws.length ? `<button class="link" data-act="share">${icon('share', 'sm')} Share</button>` : '')}
    ${items || '<p class="muted pad">Finished workouts will show up here.</p>'}<div class="spacer"></div>`;
  return { html, actions: { share: shareHistory } };
}

// ----- settings -----

function viewSettings() {
  const s = st();
  const rests = [30, 45, 60, 75, 90, 105, 120, 150, 180, 240, 300];
  const html = `${topbar(backBtn(), '<b>Settings</b>', '')}
    <section class="card">
      <label class="field"><span>Rest timer</span>
        <select data-f="rest">${rests.map(r => `<option value="${r}" ${r === s.settings.restSeconds ? 'selected' : ''}>${fmtClock(r)}</option>`).join('')}</select>
        <small>Starts automatically each time you tick off a set.</small></label>
    </section>
    <section class="card">
      <p><b>Your data</b></p>
      <p class="muted small">Everything is stored on this phone only. No account needed. Save a backup file now and then if you want to keep it safe.</p>
      <button class="btn" data-act="export">Save backup file</button>
      <label class="btn">Restore from backup<input type="file" accept="application/json,.json" data-import hidden></label>
      <button class="btn danger ghost" data-act="reset">Erase everything</button>
    </section>`;
  const actions = {
    export: () => {
      const blob = new Blob([JSON.stringify(s, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `gym-log-${dayKey(Date.now())}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    },
    reset: () => {
      if (!confirm('Erase all routines, workouts and custom exercises?')) return;
      store.reset();
      go('/');
    },
  };
  const onChange = t => {
    if (t.dataset.f === 'rest') { s.settings.restSeconds = +t.value; save(); }
    if (t.hasAttribute('data-import') && t.files[0]) {
      t.files[0].text().then(txt => {
        const data = JSON.parse(txt);
        if (!Array.isArray(data.workouts) || !Array.isArray(data.exercises)) throw new Error('bad file');
        if (!confirm('Replace everything on this phone with the backup?')) return;
        store.replace(data);
        toast('Backup restored');
        go('/');
      }).catch(() => toast('That file is not a valid backup'));
    }
  };
  return { html, actions, onChange };
}

// ---------- router ----------

let view = null;
let lastKey = '';

function render() {
  const r = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  currentRoute = r;
  const [a, b] = r;
  const views = {
    workout: () => viewWorkout(b), plans: viewPlans, plan: () => viewPlan(b), exercises: viewExercises,
    exercise: () => viewExercise(b), history: viewHistory, settings: viewSettings,
  };
  const v = (views[a] || viewHome)();
  if (!v) return; // redirected
  view = v;
  const key = r.join('/');
  const y = window.scrollY;
  const focused = document.activeElement?.closest?.('#app') ? document.activeElement : null;
  app.innerHTML = v.html;
  window.scrollTo(0, key === lastKey ? y : 0);
  lastKey = key;
  if (focused) focused.blur();
  tick();
}

app.addEventListener('click', e => {
  const t = e.target.closest('[data-act]');
  if (!t || !view?.actions) return;
  const fn = view.actions[t.dataset.act];
  if (fn) { e.preventDefault(); fn(t, e); }
});
app.addEventListener('input', e => view?.onInput?.(e.target));
app.addEventListener('change', e => view?.onChange?.(e.target));
// Select the whole value when tapping a number so it can be overwritten in one go.
app.addEventListener('focusin', e => { if (e.target.matches('input.in')) setTimeout(() => e.target.select(), 0); });

window.addEventListener('hashchange', () => { closeSheet(); render(); });
render();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
