// Data lives in localStorage on this device. No accounts, no server.
const KEY = 'gymlog.v1';

export const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

export const MUSCLES = ['Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Glutes', 'Core', 'Mobility', 'Cardio', 'Other'];
export const MUSCLE_COLORS = {
  Chest: '#e5604f', Back: '#3b8cf0', Shoulders: '#f0a43b', Arms: '#b46cf0', Legs: '#52c08a',
  Glutes: '#e88a5a', Core: '#e8c547', Mobility: '#2fb5a8', Cardio: '#d65db1', Other: '#8e8e93',
};

// kind: how a set is logged. weight = kg × reps, reps = reps only, time = seconds.
export const KINDS = { weight: 'Weight × reps', reps: 'Reps only', time: 'Time' };

const DEFAULT_EXERCISES = [
  ['Bench Press', 'Barbell', 'Chest', 'weight'],
  ['Incline Press', 'Dumbbells', 'Chest', 'weight'],
  ['Push-up', 'Bodyweight', 'Chest', 'reps'],
  ['Chest Fly', 'Cable', 'Chest', 'weight'],
  ['Deadlift', 'Barbell', 'Back', 'weight'],
  ['Pull-up', 'Bodyweight', 'Back', 'reps'],
  ['Lat Pulldown', 'Cable', 'Back', 'weight'],
  ['Bent-over Row', 'Barbell', 'Back', 'weight'],
  ['Seated Cable Row', 'Cable', 'Back', 'weight'],
  ['Seated Shoulder Press', 'Dumbbells', 'Shoulders', 'weight'],
  ['Overhead Press', 'Barbell', 'Shoulders', 'weight'],
  ['Lateral Raise', 'Dumbbells', 'Shoulders', 'weight'],
  ['Face Pull', 'Cable', 'Shoulders', 'weight'],
  ['Bicep Curl', 'Dumbbells', 'Arms', 'weight'],
  ['Hammer Curl', 'Dumbbells', 'Arms', 'weight'],
  ['Tricep Pushdown', 'Cable', 'Arms', 'weight'],
  ['Squat', 'Barbell', 'Legs', 'weight'],
  ['Leg Press', 'Machine', 'Legs', 'weight'],
  ['Leg Extension', 'Machine', 'Legs', 'weight'],
  ['Leg Curl', 'Machine', 'Legs', 'weight'],
  ['Romanian Deadlift', 'Barbell', 'Legs', 'weight'],
  ['Bulgarian Split Squat', 'Dumbbells', 'Legs', 'weight'],
  ['Calf Raise', 'Machine', 'Legs', 'weight'],
  ['Hip Thrust', 'Barbell', 'Glutes', 'weight'],
  ['Glute Bridge', 'Bodyweight', 'Glutes', 'reps'],
  ['Hanging Leg Raise', 'Bodyweight', 'Core', 'reps'],
  ['Seated Pike Leg Lifts', 'Bodyweight', 'Core', 'reps'],
  ['Dead Bug', 'Bodyweight', 'Core', 'reps'],
  ['Plank', 'Bodyweight', 'Core', 'time'],
  ['Shoulder Mobility Warm-up', '', 'Mobility', 'time'],
  ['Hip Mobility Warm-up', '', 'Mobility', 'time'],
  ['Band Pull-apart', 'Band', 'Mobility', 'reps'],
  ['Treadmill', '', 'Cardio', 'time'],
  ['Rowing Machine', '', 'Cardio', 'time'],
];

function fresh() {
  return {
    version: 1,
    exercises: DEFAULT_EXERCISES.map(([name, equipment, muscle, kind]) => ({ id: uid(), name, equipment, muscle, kind })),
    plans: [],
    activePlanId: null,
    workouts: [],
    activeWorkoutId: null,
    restEnd: null,
    settings: { restSeconds: 120 },
  };
}

function migrate(s) {
  const d = fresh();
  return { ...d, ...s, settings: { ...d.settings, ...(s.settings || {}) } };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return migrate(JSON.parse(raw));
  } catch (e) {
    console.error('Could not load saved data', e);
  }
  return fresh();
}

export const store = {
  state: load(),
  save() {
    try { localStorage.setItem(KEY, JSON.stringify(this.state)); } catch (e) { console.error(e); }
  },
  replace(s) { this.state = migrate(s); this.save(); },
  reset() { this.state = fresh(); this.save(); },
};

const st = () => store.state;
export const exById = id => st().exercises.find(e => e.id === id);
export const planById = id => st().plans.find(p => p.id === id);
export const workoutById = id => st().workouts.find(w => w.id === id);

export const num = v => (v === '' || v == null ? NaN : parseFloat(v));

// Epley estimate, then back out the weight you could do for n reps.
export function estNRM(kg, reps, n) {
  kg = num(kg); reps = num(reps);
  if (!(kg > 0) || !(reps > 0)) return NaN;
  const oneRM = reps === 1 ? kg : kg * (1 + reps / 30);
  return n === 1 ? oneRM : oneRM / (1 + n / 30);
}

export function dayKey(d) {
  d = new Date(d);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function startOfWeek(d = new Date()) {
  d = new Date(d);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay());
}

export function weekNumber(plan) {
  const diff = startOfWeek() - startOfWeek(plan.createdAt);
  return Math.round(diff / (7 * 864e5)) + 1;
}

export const entryDone = e => !!e && e.sets.length > 0 && e.sets.every(s => s.done);

// Most recent finished workout before `before` that has done sets for this exercise.
export function lastPerformance(exerciseId, before = Date.now(), excludeId = null) {
  const ws = st().workouts
    .filter(w => w.finishedAt && w.id !== excludeId && w.startedAt < before)
    .sort((a, b) => b.startedAt - a.startedAt);
  for (const w of ws) {
    const entry = w.entries.find(e => e.exerciseId === exerciseId && e.sets.some(s => s.done));
    if (entry) return { workout: w, entry };
  }
  return null;
}

export function makeSet(over = {}) {
  return { id: uid(), warmup: false, kg: '', reps: '', sec: '', done: false, ...over };
}

// Build a workout entry, pre-filling weights from last time and reps/time from the target.
export function makeEntry(exerciseId, item = {}, before = Date.now()) {
  const target = item.target ?? '';
  const nSets = item.sets ?? 3;
  const nWarm = item.warmups ?? 0;
  const prev = lastPerformance(exerciseId, before);
  const prevWork = prev ? prev.entry.sets.filter(s => s.done && !s.warmup) : [];
  const prevWarm = prev ? prev.entry.sets.filter(s => s.done && s.warmup) : [];
  const ex = exById(exerciseId);
  const targetField = ex?.kind === 'time' ? 'sec' : 'reps';
  const sets = [];
  for (let i = 0; i < nWarm; i++) {
    const p = prevWarm[i] || {};
    sets.push(makeSet({ warmup: true, kg: p.kg ?? '', reps: p.reps ?? '', sec: p.sec ?? '' }));
  }
  for (let i = 0; i < nSets; i++) {
    const p = prevWork[i] || prevWork[prevWork.length - 1] || {};
    sets.push(makeSet({ kg: p.kg ?? '', reps: p.reps ?? '', sec: p.sec ?? '', [targetField]: target !== '' ? target : (p[targetField] ?? '') }));
  }
  return { id: uid(), exerciseId, target, sets };
}

export function startWorkout(plan, day) {
  const now = Date.now();
  const w = {
    id: uid(), planId: plan?.id ?? null, dayId: day?.id ?? null,
    name: day ? day.name : 'Workout', startedAt: now, finishedAt: null, entries: [],
  };
  if (day) for (const item of day.items) w.entries.push(makeEntry(item.exerciseId, item, now));
  st().workouts.push(w);
  st().activeWorkoutId = w.id;
  store.save();
  return w;
}
