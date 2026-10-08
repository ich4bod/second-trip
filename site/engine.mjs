export const items = [
  { id: 'coin', name: 'Silver coin', room: 'hall', weight: 1, value: 1 },
  { id: 'cup', name: 'Copper cup', room: 'well', weight: 2, value: 5 },
  { id: 'idol', name: 'Stone idol', room: 'vault', weight: 4, value: 12 },
  { id: 'ruby', name: 'Red ruby', room: 'vault', weight: 2, value: 7 },
  { id: 'flask', name: 'Fuel flask', room: 'well', weight: 2, value: 0 },
];

export const edges = [
  ['gate', 'hall', 1],
  ['hall', 'well', 1],
  ['hall', 'vault', 1],
  ['well', 'vault', 2],
];

export const rooms = [
  { id: 'gate', name: 'Gate' },
  { id: 'hall', name: 'Hall' },
  { id: 'well', name: 'Well' },
  { id: 'vault', name: 'Vault' },
];

const capacity = 6;
const weightOf = id => items.find(item => item.id === id)?.weight ?? 0;
const valueOf = ids => ids.reduce((total, id) => total + (items.find(item => item.id === id)?.value ?? 0), 0);
const packWeight = pack => pack.reduce((total, id) => total + weightOf(id), 0);

export function create({ fuel = 20 } = {}) {
  const startingFuel = [8, 12, 20].includes(fuel) ? fuel : 20;
  return {
    room: 'gate',
    fuel: startingFuel,
    pack: [],
    ground: { gate: [], hall: ['coin'], well: ['cup', 'flask'], vault: ['idol', 'ruby'] },
    banked: [],
    trips: 0,
    status: 'playing',
  };
}

function clone(state) {
  return { ...state, pack: [...state.pack], banked: [...state.banked], ground: Object.fromEntries(Object.entries(state.ground).map(([room, ids]) => [room, [...ids]])) };
}

export function act(state, action) {
  if (!state || state.status !== 'playing' || !action) return state;
  const next = clone(state);
  switch (action.type) {
    case 'move': {
      const edge = edges.find(([a, b]) => (a === state.room && b === action.id) || (b === state.room && a === action.id));
      if (!edge || (state.trips >= 1 && edge[0] === 'hall' && edge[1] === 'vault')) return state;
      const cost = edge[2] * (packWeight(state.pack) > 3 ? 2 : 1);
      if (state.fuel < cost) return state;
      next.room = action.id;
      next.fuel -= cost;
      if (next.fuel === 0 && next.room !== 'gate') next.status = 'stranded';
      return next;
    }
    case 'take': {
      if (!items.some(item => item.id === action.id) || !state.ground[state.room]?.includes(action.id) || packWeight(state.pack) + weightOf(action.id) > capacity) return state;
      next.ground[state.room].splice(next.ground[state.room].indexOf(action.id), 1);
      next.pack.push(action.id);
      return next;
    }
    case 'drop': {
      if (!state.pack.includes(action.id)) return state;
      next.pack.splice(next.pack.indexOf(action.id), 1);
      next.ground[state.room].push(action.id);
      return next;
    }
    case 'bank-one': {
      if (state.room !== 'gate' || !state.pack.includes(action.id)) return state;
      next.pack.splice(next.pack.indexOf(action.id), 1);
      if (action.id === 'flask') next.fuel = Math.min(20, next.fuel + 8);
      else next.banked.push(action.id);
      next.trips += 1;
      return next;
    }
    case 'bank': {
      if (state.room !== 'gate' || state.pack.length === 0) return state;
      const carriedFlask = next.pack.includes('flask');
      next.banked.push(...next.pack.filter(id => id !== 'flask'));
      next.pack = [];
      if (carriedFlask) next.fuel = Math.min(20, next.fuel + 8);
      next.trips += 1;
      return next;
    }
    case 'leave':
      if (state.room !== 'gate') return state;
      next.status = 'left';
      return next;
    default:
      return state;
  }
}

export { capacity, packWeight, valueOf };
