import { act, capacity, create, edges, items, packWeight, rooms, valueOf } from './engine.mjs?v=drink1';

let startingFuel = 20;
let passageMode = 'wide';
let state = create({ fuel: startingFuel, passage: passageMode });
let kept = null;
const history = [];
let exchangeDrop = null;
const byId = id => document.getElementById(id);
const names = Object.fromEntries(rooms.map(room => [room.id, room.name]));
const itemById = Object.fromEntries(items.map(item => [item.id, item]));
const ended = () => state.status !== 'playing';
const keptPassage = snapshot => snapshot?.state.passage === 'narrow' ? 'narrow' : 'wide';
const isKeptAttempt = () => !!kept
  && JSON.stringify(state) === JSON.stringify(kept.state)
  && startingFuel === kept.startingFuel
  && passageMode === keptPassage(kept);
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
    vault: current.trips >= 1 || (current.passage === 'narrow' && weight > 3)
      ? { rooms: ['vault', 'well', 'hall', 'gate'], baseCost: 4 }
      : { rooms: ['vault', 'hall', 'gate'], baseCost: 2 },
  };
  const route = routes[current.room];
  const cost = route.baseCost * (weight > 3 ? 2 : 1);
  return { path: route.rooms.map(room => names[room]).join(' → '), destination: route.rooms[1], cost, margin: current.fuel - cost };
};
const homewardMove = current => {
  const { destination } = returnRoute(current);
  const edge = edges.find(([a, b]) => (a === current.room && b === destination) || (b === current.room && a === destination));
  const action = { type: 'move', id: destination };
  return {
    destination,
    cost: edge ? edge[2] * (packWeight(current.pack) > 3 ? 2 : 1) : 0,
    action,
    allowed: !!edge && act(current, action) !== current,
  };
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
const exchangePreview = takeId => {
  const drop = itemById[exchangeDrop];
  const take = itemById[takeId];
  if (!drop || !take || !state.pack.includes(exchangeDrop) || !state.ground[state.room]?.includes(takeId)) {
    return 'Choose a carried item to preview this trade.';
  }
  const hypotheticalWeight = packWeight(state.pack) - drop.weight + take.weight;
  if (hypotheticalWeight > capacity) return 'This trade does not fit the pack.';
  const route = returnRoute(state, hypotheticalWeight);
  const marginText = route.margin >= 0
    ? `fuel after return ${route.margin}`
    : `short by ${-route.margin} fuel`;
  return `Trade ${drop.name} for ${take.name}: pack ${hypotheticalWeight} / ${capacity} · return ${route.cost} fuel · ${marginText}.`;
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
  const homeward = homewardMove(state);
  byId('homeward-step').textContent = homeward.destination
    ? `Take the road to ${names[homeward.destination]} · ${homeward.cost} fuel`
    : 'Already at the gate';
  byId('homeward-step').disabled = !homeward.allowed;
  byId('pack-weight').textContent = weight <= 3
    ? `Pack: ${weight} / 6 weight. Light: roads cost the marked fuel.`
    : `Pack: ${weight} / 6 weight. Heavy: roads cost twice as much fuel.`;
  byId('flask-help').textContent = 'The flask takes two weight. Use it here or bank it at the gate to add eight fuel, up to twenty. It is spent once; it is not treasure.';
  byId('banked-value').textContent = `Safe at the gate: ${valueOf(state.banked)} treasure value.`;
  byId('trips').textContent = `Banked hauls: ${state.trips}.`;
  byId('passage-note').textContent = passageMode === 'narrow'
    ? 'The low lintel accepts at most three pack weight.'
    : 'The standing arch accepts any legal pack.';
  document.querySelector('[data-edge="hall-vault"]').classList.toggle('narrow', passageMode === 'narrow');
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
    const isArch = a === 'hall' && b === 'vault';
    const archClosed = state.trips >= 1 && isArch;
    const packBlocked = state.passage === 'narrow' && weight > 3 && isArch;
    const cost = baseCost * (weight > 3 ? 2 : 1);
    const roadText = archClosed ? `To ${names[destination]} · arch closed`
      : packBlocked ? `To ${names[destination]} · pack too heavy`
        : `To ${names[destination]} · ${cost} fuel`;
    const action = { type: 'move', id: destination };
    roadList.append(button(`move-${destination}`, roadText, act(state, action) === state, () => save(act(state, action))));
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
    const exchangeReturn = document.createElement('p');
    exchangeReturn.id = `exchange-return-${id}`;
    exchangeReturn.textContent = exchangePreview(id);
    row.append(exchangeReturn);
    floor.append(row);
  }
  const takeReturnList = byId('take-return-list');
  takeReturnList.replaceChildren();
  if (floorItems.length === 0) takeReturnList.textContent = 'Nothing here to carry.';
  for (const id of floorItems) {
    const item = itemById[id];
    const hypotheticalWeight = weight + item.weight;
    const preview = document.createElement('p');
    preview.id = `take-return-${id}`;
    if (hypotheticalWeight > capacity) {
      preview.textContent = `${item.name} does not fit this pack.`;
    } else {
      const hypotheticalRoute = returnRoute(state, hypotheticalWeight);
      const marginText = hypotheticalRoute.margin >= 0
        ? `fuel after return ${hypotheticalRoute.margin}`
        : `short by ${-hypotheticalRoute.margin} fuel`;
      preview.textContent = `After taking ${item.name}: pack ${hypotheticalWeight} / ${capacity} · return ${hypotheticalRoute.cost} fuel · ${marginText}.`;
    }
    takeReturnList.append(preview);
  }
  const pack = byId('pack');
  pack.replaceChildren();
  if (state.pack.length === 0) pack.textContent = 'Your pack is empty.';
  for (const id of state.pack) {
    const row = document.createElement('div');
    row.className = 'item-row';
    row.append(document.createTextNode(itemText(id)));
    row.append(button(`drop-${id}`, `Drop ${itemById[id].name}`, ended(), () => save(act(state, { type: 'drop', id }))));
    const bankOnly = button(`bank-only-${id}`, `Bank only ${itemById[id].name}`, ended(), () => save(act(state, { type: 'bank-one', id })));
    bankOnly.hidden = state.room !== 'gate';
    row.append(bankOnly);
    const bankCandidate = act(state, { type: 'bank-one', id });
    const bankPreview = document.createElement('p');
    bankPreview.id = `bank-item-preview-${id}`;
    bankPreview.hidden = bankCandidate === state;
    if (bankCandidate !== state) {
      bankPreview.textContent = `After banking ${itemById[id].name}: safe ${valueOf(bankCandidate.banked)} · pack ${packWeight(bankCandidate.pack)} / ${capacity} · lantern ${bankCandidate.fuel} / 20 · arch ${bankCandidate.trips >= 1 ? 'fallen' : 'standing'}.`;
    }
    row.append(bankPreview);
    const hypotheticalWeight = weight - itemById[id].weight;
    const hypotheticalRoute = returnRoute(state, hypotheticalWeight);
    const preview = document.createElement('p');
    preview.id = `drop-preview-${id}`;
    preview.textContent = `After dropping: ${hypotheticalWeight} weight · return ${hypotheticalRoute.cost} fuel.`;
    row.append(preview);
    if (id === 'flask') {
      row.append(button('use-flask', 'Use the fuel flask', ended() || state.fuel >= 20, () => save(act(state, { type: 'drink' }))));
      const nextFuel = Math.min(20, state.fuel + 8);
      const addedFuel = nextFuel - state.fuel;
      const flaskPreview = document.createElement('p');
      flaskPreview.id = 'use-flask-preview';
      flaskPreview.textContent = `Use flask: ${state.fuel} → ${nextFuel} fuel · ${addedFuel} fuel added · ${8 - addedFuel} fuel clipped.`;
      row.append(flaskPreview);
    }
    pack.append(row);
  }

  byId('unload-treasure').disabled = ended() || !state.pack.some(id => id !== 'flask');
  byId('bank').disabled = ended() || state.room !== 'gate' || state.pack.length === 0;
  byId('leave').disabled = ended() || state.room !== 'gate';
  const leaveCandidate = act(state, { type: 'leave' });
  const leavePreview = byId('leave-preview');
  leavePreview.hidden = leaveCandidate === state;
  leavePreview.textContent = `Leave now: ${valueOf(state.banked)} treasure value safe; ${valueOf(state.pack)} carried treasure value will not count.`;
  byId('undo').disabled = history.length === 0;
  byId('restart').disabled = false;
  const keepButton = byId('trip-keep');
  const returnButton = byId('trip-return');
  const forgetButton = byId('trip-forget');
  const keptInfo = byId('trip-kept-info');
  keepButton.disabled = false;
  returnButton.disabled = !kept || isKeptAttempt();
  forgetButton.disabled = !kept;
  keptInfo.textContent = kept
    ? `Kept: ${names[kept.state.room]} · ${kept.state.fuel} fuel · ${packWeight(kept.state.pack)} weight · ${valueOf(kept.state.banked)} safe value · arch ${kept.state.trips >= 1 ? 'fallen' : 'standing'}.`
    : 'No attempt kept.';
}

byId('exchange-drop').addEventListener('change', () => {
  exchangeDrop = byId('exchange-drop').value || null;
  for (const tradeButton of document.querySelectorAll('#floor [data-exchange-take]')) {
    const takeId = tradeButton.dataset.exchangeTake;
    tradeButton.disabled = !canExchange(state, exchangeDrop, takeId);
    byId(`exchange-return-${takeId}`).textContent = exchangePreview(takeId);
  }
});
byId('homeward-step').addEventListener('click', () => {
  const homeward = homewardMove(state);
  if (!homeward.allowed) return;
  save(act(state, homeward.action));
});
byId('unload-treasure').addEventListener('click', () => save(act(state, { type: 'unload' })));
byId('bank').addEventListener('click', () => save(act(state, { type: 'bank' })));
byId('leave').addEventListener('click', () => save(act(state, { type: 'leave' })));
byId('undo').addEventListener('click', () => {
  if (history.length) {
    state = history.pop();
    render();
  }
});
const restart = () => {
  state = create({ fuel: startingFuel, passage: passageMode });
  exchangeDrop = null;
  history.length = 0;
  render();
};
byId('starting-fuel').addEventListener('change', () => {
  const selected = Number(byId('starting-fuel').value);
  startingFuel = [8, 12, 20].includes(selected) ? selected : 20;
  restart();
});
byId('passage-mode').addEventListener('change', () => {
  passageMode = byId('passage-mode').value === 'narrow' ? 'narrow' : 'wide';
  restart();
});
byId('restart').addEventListener('click', restart);
byId('trip-keep').addEventListener('click', () => {
  kept = { state: structuredClone(state), startingFuel };
  render();
});
byId('trip-return').addEventListener('click', () => {
  if (!kept || isKeptAttempt()) return;
  state = structuredClone(kept.state);
  startingFuel = kept.startingFuel;
  passageMode = keptPassage(kept);
  byId('starting-fuel').value = String(startingFuel);
  byId('passage-mode').value = passageMode;
  exchangeDrop = null;
  history.length = 0;
  render();
});
byId('trip-forget').addEventListener('click', () => {
  if (!kept) return;
  kept = null;
  render();
});
render();
