import { act, create, edges, items, packWeight, rooms, valueOf } from './engine.mjs?v=flask1';

let state = create();
const history = [];
let exchangeDrop = null;
const byId = id => document.getElementById(id);
const names = Object.fromEntries(rooms.map(room => [room.id, room.name]));
const itemById = Object.fromEntries(items.map(item => [item.id, item]));
const ended = () => state.status !== 'playing';
const canExchange = (current, dropId, takeId) => {
  const drop = itemById[dropId];
  const take = itemById[takeId];
  return current.status === 'playing'
    && current.pack.includes(dropId)
    && current.ground[current.room]?.includes(takeId)
    && !!drop && !!take
    && packWeight(current.pack) - drop.weight + take.weight <= 6;
};
const returnRoute = (current, weight = packWeight(current.pack)) => {
  const routes = {
    gate: { rooms: ['gate'], baseCost: 0 },
    hall: { rooms: ['hall', 'gate'], baseCost: 1 },
    well: { rooms: ['well', 'hall', 'gate'], baseCost: 2 },
    vault: current.trips >= 1
      ? { rooms: ['vault', 'well', 'hall', 'gate'], baseCost: 4 }
      : { rooms: ['vault', 'hall', 'gate'], baseCost: 2 },
  };
  const route = routes[current.room];
  const cost = route.baseCost * (weight > 3 ? 2 : 1);
  return { path: route.rooms.map(room => names[room]).join(' → '), cost, margin: current.fuel - cost };
};
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
  const route = returnRoute(state, weight);
  byId('gate-route').textContent = `${route.path} · ${route.cost} fuel with this pack.`;
  byId('gate-margin').textContent = route.margin >= 0
    ? `Fuel after reaching the gate: ${route.margin}.`
    : `Short by ${-route.margin} fuel with this pack.`;
  byId('pack-weight').textContent = weight <= 3
    ? `Pack: ${weight} / 6 weight. Light: roads cost the marked fuel.`
    : `Pack: ${weight} / 6 weight. Heavy: roads cost twice as much fuel.`;
  byId('flask-help').textContent = 'The flask takes two weight. Bank it at the gate to add eight fuel, up to twenty. It is spent once; it is not treasure.';
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

  if (exchangeDrop !== null && !state.pack.includes(exchangeDrop)) exchangeDrop = null;
  const exchangeSelect = byId('exchange-drop');
  exchangeSelect.replaceChildren();
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = 'Choose one carried item';
  exchangeSelect.append(placeholder);
  for (const id of state.pack) {
    const option = document.createElement('option');
    option.value = id;
    option.textContent = itemById[id].name;
    exchangeSelect.append(option);
  }
  exchangeSelect.value = exchangeDrop ?? '';
  exchangeSelect.disabled = ended() || state.pack.length === 0;
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
    const trade = button(`exchange-${id}`, `Trade for ${itemById[id].name}`, !canExchange(state, exchangeDrop, id), () => {
      if (!canExchange(state, exchangeDrop, id)) return;
      const intermediate = act(state, { type: 'drop', id: exchangeDrop });
      if (intermediate === state) return;
      const next = act(intermediate, { type: 'take', id });
      if (next === intermediate) return;
      save(next);
    });
    trade.dataset.exchangeTake = id;
    row.append(trade);
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
    const hypotheticalWeight = weight - itemById[id].weight;
    const hypotheticalRoute = returnRoute(state, hypotheticalWeight);
    const preview = document.createElement('p');
    preview.id = `drop-preview-${id}`;
    preview.textContent = `After dropping: ${hypotheticalWeight} weight · return ${hypotheticalRoute.cost} fuel.`;
    row.append(preview);
    pack.append(row);
  }

  byId('bank').disabled = ended() || state.room !== 'gate' || state.pack.length === 0;
  byId('leave').disabled = ended() || state.room !== 'gate';
  byId('undo').disabled = history.length === 0;
  byId('restart').disabled = false;
}

byId('exchange-drop').addEventListener('change', () => {
  exchangeDrop = byId('exchange-drop').value || null;
  for (const tradeButton of document.querySelectorAll('#floor [data-exchange-take]')) {
    tradeButton.disabled = !canExchange(state, exchangeDrop, tradeButton.dataset.exchangeTake);
  }
});
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
  exchangeDrop = null;
  history.length = 0;
  render();
});
render();
