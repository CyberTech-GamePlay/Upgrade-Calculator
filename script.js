
const monitors = [
  'Nvision 19" 75Hz',
  'Supervision 19" 75Hz',
  'Nvision 20" 75Hz',
  'Nvision 21.5" 75Hz',
  'Viewpoint 22" 75Hz',
  'Nvision 24" 100Hz (Black)',
  'Nvision 24" 100Hz (White)',
  'Supervision 24" 100Hz (Black)',
  'Supervision 24" 100Hz (White)',
  'Nvision 24" 144Hz (Black)',
  'Nvision 24" 144Hz (White)',
  'Viewpoint 24" 120Hz (Black)',
  'Viewpoint 24" 120Hz (White)',
  'Nvision 27" 144Hz (Black)',
  'Nvision 27" 144Hz (White)',
  'Viewpoint 27" 120Hz (Black)',
  'Viewpoint 27" 120Hz (White)',
  'Nvision 27" 240Hz (Black)',
  'Nvision 27" 180Hz (White)',
  'Nvision 32" 180Hz (Black)'
];

const STORAGE_KEY = 'cbd-upgrade-prices-v1';
const savedPrices = loadPrices();
const costs = savedPrices.costs;
const otherItems = savedPrices.items;

// These five models have a ₱500 upgrade fee.
const nonHighEnd = [
  'Nvision 19" 75Hz',
  'Supervision 19" 75Hz',
  'Nvision 20" 75Hz',
  'Nvision 21.5" 75Hz',
  'Viewpoint 22" 75Hz'
];

const current = document.getElementById('currentMonitor');
const target = document.getElementById('newMonitor');

function money(amount) {
  return '₱' + amount.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function loadPrices() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return {
      costs: saved && saved.costs && typeof saved.costs === 'object' ? saved.costs : {},
      items: saved && Array.isArray(saved.items) ? saved.items : []
    };
  } catch (error) {
    return { costs: {}, items: [] };
  }
}

// Add every monitor to both dropdowns.
monitors.forEach(function (monitor) {
  current.add(new Option(monitor, monitor));
  target.add(new Option(monitor, monitor));
});

// Choose different default monitors.
current.selectedIndex = 0;
target.selectedIndex = 5;

function getFee(monitor) {
  if (nonHighEnd.includes(monitor)) {
    return 500;
  }

  const match = monitor.match(/(\d+)Hz/i);
  const refreshRate = match ? Number(match[1]) : 0;

  if (refreshRate >= 180) {
    return 1500;
  }

  return 1000;
}

function calculateUpgrade() {
  // Disable the current monitor in the new monitor list.
  Array.from(target.options).forEach(function (option) {
    option.disabled = option.value === current.value;
  });

  if (target.value === current.value) {
    const available = Array.from(target.options).find(
      option => !option.disabled
    );

    if (available) {
      target.value = available.value;
    }
  }

  const currentName = current.value;
  const newName = target.value;

  const currentPrice = Number(costs[currentName] || 0);
  const newPrice = Number(costs[newName] || 0);
  const fee = getFee(newName);

  const total = newPrice - currentPrice + fee;

  // Update the summary panel.
  document.getElementById('summaryCurrent').textContent =
    currentName;

  document.getElementById('summaryNew').textContent =
    newName;

  document.getElementById('currentCost').textContent =
    money(currentPrice);

  document.getElementById('newCost').textContent =
    money(newPrice);

  document.getElementById('upgradeFee').textContent =
    money(fee);

  document.getElementById('totalPrice').textContent =
    money(total);
}

// Recalculate when either selection changes.
current.addEventListener('change', calculateUpgrade);
target.addEventListener('change', calculateUpgrade);

// Switch categories in the sidebar.
function showCategory(category) {
  const names = {
    monitor: 'MONITOR UPGRADE',
    storage: 'STORAGE UPGRADE',
    ram: 'RAM UPGRADE',
    gpu: 'GPU UPGRADE',
    casing: 'CASING UPGRADE'
  };

  document.getElementById('pageTitle').textContent =
    names[category];

  document.getElementById('monitorPanel').classList.toggle(
    'hidden', category !== 'monitor'
  );

  document.getElementById('comingPanel').classList.toggle(
    'hidden', category === 'monitor'
  );

  document.getElementById('comingTitle').textContent =
    names[category] + ' — COMING SOON';

  document.querySelectorAll('.menu-button').forEach(function (button) {
    button.classList.toggle(
      'active',
      button.textContent.toLowerCase().includes(category)
    );
  });
}

function adminLogin() {
  renderAdmin();
  document.getElementById('adminModal').classList.remove('hidden');
  document.getElementById('adminStatus').textContent = '';
}

function renderAdmin() {
  const monitorRows = document.getElementById('monitorCostRows');
  monitorRows.replaceChildren();

  monitors.forEach(function (monitor) {
    const row = document.createElement('tr');
    const name = document.createElement('td');
    const costCell = document.createElement('td');
    const input = document.createElement('input');

    name.textContent = monitor;
    input.type = 'number';
    input.min = '0';
    input.step = '0.01';
    input.value = Number(costs[monitor] || 0);
    input.setAttribute('aria-label', 'Cost for ' + monitor);
    input.addEventListener('input', function () {
      costs[monitor] = Math.max(0, Number(input.value) || 0);
      calculateUpgrade();
    });

    costCell.appendChild(input);
    row.append(name, costCell);
    monitorRows.appendChild(row);
  });

  const itemRows = document.getElementById('otherItemRows');
  itemRows.replaceChildren();

  otherItems.forEach(function (item, index) {
    const row = document.createElement('tr');
    const name = document.createElement('td');
    const category = document.createElement('td');
    const cost = document.createElement('td');
    const action = document.createElement('td');
    const costInput = document.createElement('input');
    const remove = document.createElement('button');

    name.textContent = item.name;
    category.textContent = item.category.toUpperCase();
    costInput.type = 'number';
    costInput.min = '0';
    costInput.step = '0.01';
    costInput.value = Number(item.cost) || 0;
    costInput.setAttribute('aria-label', 'Cost for ' + item.name);
    costInput.addEventListener('input', function () {
      item.cost = Math.max(0, Number(costInput.value) || 0);
    });
    cost.appendChild(costInput);
    remove.type = 'button';
    remove.className = 'admin-remove';
    remove.textContent = 'Remove';
    remove.addEventListener('click', function () {
      otherItems.splice(index, 1);
      renderAdmin();
    });

    action.appendChild(remove);
    row.append(name, category, cost, action);
    itemRows.appendChild(row);
  });
}

document.getElementById('closeAdmin').addEventListener('click', function () {
  document.getElementById('adminModal').classList.add('hidden');
});

document.getElementById('adminModal').addEventListener('click', function (event) {
  if (event.target.id === 'adminModal') {
    event.currentTarget.classList.add('hidden');
  }
});

document.getElementById('itemForm').addEventListener('submit', function (event) {
  event.preventDefault();
  otherItems.push({
    name: document.getElementById('itemName').value.trim(),
    category: document.getElementById('itemCategory').value,
    cost: Math.max(0, Number(document.getElementById('itemCost').value) || 0)
  });
  event.currentTarget.reset();
  renderAdmin();
});

document.getElementById('saveAdmin').addEventListener('click', function () {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ costs: costs, items: otherItems }));
  calculateUpgrade();
  document.getElementById('adminStatus').textContent = 'Changes saved in this browser.';
});

// Show the initial calculation.
calculateUpgrade();
