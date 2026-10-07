import { act, create, edges, items, packWeight, rooms, valueOf } from './engine.mjs?v=arch1';

let state = create();
const history = [];
const byId = id => document.getElementById(id);
const names = Object.fromEntries(rooms.map(room => [room.id, room.name]));
const itemById = Object.fromEntries(items.map(item => [item.id, item]));
const ended = () => state.status !== 'playing';
const button = (id, text, disabled, handler) => {
  const element = document.createElement('button');
  element.type = 'button';
  element.id = id;
  element.textContent = text;
  element.disabled = disabled;
  element.addEventListener('click', handler);
  return element;
};
const itemText = id => {
  const item = itemById[id];
  return `${item.name} · weight ${item.weight} · value ${item.value}.`;
};
const save = next => {
  if (next === state) return;
  history.push(structuredClone(state));
  if (history.length > 24) history.shift();
  state = next;
  render();
};

function render() {
  const weight = packWeight(state.pack);
  byId('where').textContent = `You are at ${names[state.room]}.`;
  byId('fuel').textContent = `Lantern: ${state.fuel} / 20 fuel.`;
  byId('pack-weight').textContent = weight <= 3
    ? `Pack: ${weight} / 6 weight. Light: roads cost the marked fuel.`
    : `Pack: ${weight} / 6 weight. Heavy: roads cost twice as much fuel.`;
  byId('banked-value').textContent = `Safe at the gate: ${valueOf(state.banked)} treasure value.`;
  byId('trips').textContent = `Banked hauls: ${state.trips}.`;
  byId('arch-note').textContent = state.trips === 0
    ? 'The short arch stands until you bank your first haul.'
    : 'The short arch has fallen. The Well road is still open.';
  document.querySelector('[data-edge="hall-vault"]').classList.toggle('closed', state.trips >= 1);
  byId('result').textContent = state.status === 'stranded'
    ? 'The lantern went out away from the gate. Only banked treasure is safe. Undo a choice or start again.'
    : state.status === 'left'
      ? `You left with ${valueOf(state.banked)} treasure value safe. What remains can stay in the dark.`
      : '';

  for (const node of document.querySelectorAll('#map-nodes circle')) {
    node.classList.toggle('current', node.dataset.room === state.room);
  }

  const roadList = byId('roads');
  roadList.replaceChildren();
  for (const [a, b, baseCost] of edges) {
    const destination = a === state.room ? b : b === state.room ? a : null;
    if (!destination) continue;
    const archClosed = state.trips >= 1 && ((state.room === 'hall' && destination === 'vault') || (state.room === 'vault' && destination === 'hall'));
    const cost = baseCost * (weight > 3 ? 2 : 1);
    roadList.append(button(`move-${destination}`, archClosed ? `To ${names[destination]} · arch closed` : `To ${names[destination]} · ${cost} fuel`, ended() || archClosed || state.fuel < cost, () => save(act(state, { type: 'move', id: destination }))));
  }

  const floor = byId('floor');
  floor.replaceChildren();
  const floorItems = state.ground[state.room] ?? [];
  if (floorItems.length === 0) floor.textContent = 'Nothing here to carry.';
  for (const id of floorItems) {
    const row = document.createElement('div');
    row.className = 'item-row';
    row.append(document.createTextNode(itemText(id)));
    row.append(button(`take-${id}`, `Take ${itemById[id].name}`, ended() || weight + itemById[id].weight > 6, () => save(act(state, { type: 'take', id }))));
    floor.append(row);
  }

  const pack = byId('pack');
  pack.replaceChildren();
  if (state.pack.length === 0) pack.textContent = 'Your pack is empty.';
  for (const id of state.pack) {
    const row = document.createElement('div');
    row.className = 'item-row';
    row.append(document.createTextNode(itemText(id)));
    row.append(button(`drop-${id}`, `Drop ${itemById[id].name}`, ended(), () => save(act(state, { type: 'drop', id }))));
    pack.append(row);
  }

  byId('bank').disabled = ended() || state.room !== 'gate' || state.pack.length === 0;
  byId('leave').disabled = ended() || state.room !== 'gate';
  byId('undo').disabled = history.length === 0;
  byId('restart').disabled = false;
}

byId('bank').addEventListener('click', () => save(act(state, { type: 'bank' })));
byId('leave').addEventListener('click', () => save(act(state, { type: 'leave' })));
byId('undo').addEventListener('click', () => {
  if (history.length) {
    state = history.pop();
    render();
  }
});
byId('restart').addEventListener('click', () => {
  state = create();
  history.length = 0;
  render();
});
render();
