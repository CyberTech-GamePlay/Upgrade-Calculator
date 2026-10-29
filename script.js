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

const LEGACY_STORAGE_KEY = 'cbd-upgrade-prices-v1';
const nonHighEnd = [
  'Nvision 19" 75Hz',
  'Supervision 19" 75Hz',
  'Nvision 20" 75Hz',
  'Nvision 21.5" 75Hz',
  'Viewpoint 22" 75Hz'
];

const current = document.getElementById('currentMonitor');
const target = document.getElementById('newMonitor');
const adminModal = document.getElementById('adminModal');
const adminEditor = document.getElementById('adminEditor');
const adminLoginPanel = document.getElementById('adminLoginPanel');
const adminStatus = document.getElementById('adminStatus');
const loginStatus = document.getElementById('loginStatus');
const saveAdminButton = document.getElementById('saveAdmin');
const reloadSharedButton = document.getElementById('reloadShared');

const supabaseConfig = window.CBD_SUPABASE_CONFIG || {};
const adminUserId = String(window.CBD_SUPABASE_ADMIN_UID || '').toLowerCase();
let supabaseClient = null;
let costs = {};
let otherItems = [];
let adminUser = null;
let adminSessionReady = false;
let sharedPricesLoaded = false;
let databaseConnected = false;
let editorDirty = false;
let pendingRemoteData = null;
let lastUpdatedAt = null;
let savingPrices = false;

function normalizeCosts(value) {
  const source = value && typeof value === 'object' ? value : {};
  const result = {};

  monitors.forEach(function (monitor) {
    const amount = Number(source[monitor]);
    result[monitor] = Number.isFinite(amount) && amount >= 0 ? amount : 0;
  });

  return result;
}

function normalizeItems(value) {
  const source = Array.isArray(value)
    ? value
    : (value && typeof value === 'object' ? Object.values(value) : []);

  return source
    .filter(function (item) {
      return item && typeof item.name === 'string' && item.name.trim();
    })
    .map(function (item) {
      const amount = Number(item.cost);
      return {
        name: item.name.trim(),
        category: ['storage', 'ram', 'gpu', 'casing'].includes(item.category)
          ? item.category
          : 'storage',
        cost: Number.isFinite(amount) && amount >= 0 ? amount : 0
      };
    });
}

function loadLegacyPrices() {
  try {
    const saved = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY));
    return {
      costs: normalizeCosts(saved && saved.costs),
      items: normalizeItems(saved && saved.items)
    };
  } catch (error) {
    return { costs: normalizeCosts({}), items: [] };
  }
}

const legacyPrices = loadLegacyPrices();

function money(amount) {
  return '₱' + amount.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function setSyncStatus(message) {
  document.getElementById('syncStatus').textContent = message;
}

function isAuthorized(user) {
  return Boolean(
    user &&
    adminUserId &&
    !adminUserId.includes('YOUR_') &&
    user.id &&
    user.id.toLowerCase() === adminUserId
  );
}

function updateAdminUi() {
  const isAdmin = isAuthorized(adminUser) && adminSessionReady;
  adminLoginPanel.classList.toggle('hidden', isAdmin);
  adminEditor.classList.toggle('hidden', !isAdmin);
  saveAdminButton.disabled =
    !isAdmin || !sharedPricesLoaded || !databaseConnected || savingPrices || Boolean(pendingRemoteData);
  reloadSharedButton.classList.toggle('hidden', !pendingRemoteData);
  document.getElementById('adminAccount').textContent =
    isAdmin ? 'Signed in as ' + (adminUser.email || 'admin') : '';
  document.getElementById('adminHelp').classList.toggle('hidden', isAdmin);
}

function getFee(monitor) {
  if (nonHighEnd.includes(monitor)) {
    return 500;
  }

  const match = monitor.match(/(\d+)Hz/i);
  const refreshRate = match ? Number(match[1]) : 0;
  return refreshRate >= 180 ? 1500 : 1000;
}

function calculateUpgrade() {
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

  document.getElementById('summaryCurrent').textContent = currentName;
  document.getElementById('summaryNew').textContent = newName;
  document.getElementById('currentCost').textContent = money(currentPrice);
  document.getElementById('newCost').textContent = money(newPrice);
  document.getElementById('upgradeFee').textContent = money(fee);
  document.getElementById('totalPrice').textContent = money(total);
}

function showCategory(category) {
  const names = {
    monitor: 'MONITOR UPGRADE',
    storage: 'STORAGE UPGRADE',
    ram: 'RAM UPGRADE',
    gpu: 'GPU UPGRADE',
    casing: 'CASING UPGRADE'
  };

  document.getElementById('pageTitle').textContent = names[category];
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
      button.getAttribute('onclick').includes(category)
    );
  });
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
      editorDirty = true;
      calculateUpgrade();
      updateAdminUi();
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
      editorDirty = true;
      updateAdminUi();
    });

    cost.appendChild(costInput);
    remove.type = 'button';
    remove.className = 'admin-remove';
    remove.textContent = 'Remove';
    remove.addEventListener('click', function () {
      otherItems.splice(index, 1);
      editorDirty = true;
      renderAdmin();
      updateAdminUi();
    });

    action.appendChild(remove);
    row.append(name, category, cost, action);
    itemRows.appendChild(row);
  });
}

function applySharedRow(row) {
  if (row && row.updated_at) {
    costs = normalizeCosts(row.costs);
    otherItems = normalizeItems(row.items);
    lastUpdatedAt = row.updated_at;
  } else {
    costs = legacyPrices.costs;
    otherItems = legacyPrices.items;
    lastUpdatedAt = null;
  }

  editorDirty = false;
  pendingRemoteData = null;
  sharedPricesLoaded = true;
  calculateUpgrade();

  if (adminSessionReady && isAuthorized(adminUser)) {
    renderAdmin();
  }
  updateAdminUi();
}

function receiveSharedRow(row) {
  if (adminSessionReady && isAuthorized(adminUser) && editorDirty &&
      row && row.updated_at !== lastUpdatedAt) {
    pendingRemoteData = row;
    adminStatus.textContent =
      'Prices changed in another session. Reload the latest prices before saving your edits.';
    updateAdminUi();
    return;
  }

  applySharedRow(row);
  if (row && row.updated_at) {
    setSyncStatus('Connected. Shared prices update live across devices.');
  } else {
    setSyncStatus('Connected. Save prices as admin to publish the first shared version.');
  }
}

async function loadSharedPrices() {
  if (!supabaseClient) {
    return;
  }

  try {
    const result = await supabaseClient
      .from('upgrade_pricing')
      .select('id, costs, items, updated_at')
      .eq('id', 1)
      .maybeSingle();

    if (result.error) {
      throw result.error;
    }

    databaseConnected = true;
    receiveSharedRow(result.data);
  } catch (error) {
    databaseConnected = false;
    setSyncStatus('Could not load prices. Check the Supabase table and RLS policies.');
    if (adminStatus) {
      adminStatus.textContent = 'Price loading failed: ' + error.message;
    }
    updateAdminUi();
  }
}

function initializeSupabase() {
  const configured = supabaseConfig.url &&
    !supabaseConfig.url.includes('YOUR_') &&
    supabaseConfig.publishableKey &&
    !supabaseConfig.publishableKey.includes('YOUR_') &&
    adminUserId &&
    !adminUserId.includes('YOUR_');

  if (!configured || !window.supabase || !window.supabase.createClient) {
    setSyncStatus('Supabase is not configured yet. Follow SETUP.md.');
    document.getElementById('adminHelp').textContent =
      'Add your Supabase URL, publishable key, and admin user ID, then follow SETUP.md.';
    updateAdminUi();
    return;
  }

  supabaseClient = window.supabase.createClient(
    supabaseConfig.url,
    supabaseConfig.publishableKey
  );

  supabaseClient.auth.onAuthStateChange(function (_event, session) {
    adminUser = session ? session.user : null;
    adminSessionReady = isAuthorized(adminUser);

    if (adminUser && !adminSessionReady) {
      loginStatus.textContent =
        'This account is not authorized to change prices. Use the configured admin account.';
    } else if (adminSessionReady) {
      loginStatus.textContent = '';
      adminStatus.textContent = 'Admin signed in.';
      renderAdmin();
    } else if (pendingRemoteData) {
      applySharedRow(pendingRemoteData);
    }

    updateAdminUi();
  });

  const channel = supabaseClient
    .channel('upgrade-pricing-live')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'upgrade_pricing',
        filter: 'id=eq.1'
      },
      function (payload) {
        if (payload.new) {
          databaseConnected = true;
          receiveSharedRow(payload.new);
        }
      }
    )
    .subscribe(function (status) {
      if (status === 'SUBSCRIBED') {
        databaseConnected = true;
        setSyncStatus('Connected. Shared prices update live across devices.');
        updateAdminUi();
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        setSyncStatus('Live updates are unavailable. Reload the page to refresh prices.');
        updateAdminUi();
      }
    });

  supabaseClient.auth.getSession().then(function (result) {
    if (result.error) {
      loginStatus.textContent = result.error.message;
    } else {
      adminUser = result.data.session ? result.data.session.user : null;
      adminSessionReady = isAuthorized(adminUser);
      updateAdminUi();
      if (adminSessionReady) {
        renderAdmin();
      }
    }
  });

  loadSharedPrices();
}

function adminLogin() {
  adminModal.classList.remove('hidden');
  adminStatus.textContent = '';
  loginStatus.textContent = '';
  updateAdminUi();

  if (adminSessionReady) {
    renderAdmin();
  }
}

function reloadLatestPrices() {
  editorDirty = false;
  pendingRemoteData = null;
  adminStatus.textContent = 'Loading the latest shared prices…';
  updateAdminUi();
  loadSharedPrices();
}

monitors.forEach(function (monitor) {
  current.add(new Option(monitor, monitor));
  target.add(new Option(monitor, monitor));
});

current.selectedIndex = 0;
target.selectedIndex = 5;
current.addEventListener('change', calculateUpgrade);
target.addEventListener('change', calculateUpgrade);

document.getElementById('closeAdmin').addEventListener('click', function () {
  adminModal.classList.add('hidden');
});

adminModal.addEventListener('click', function (event) {
  if (event.target.id === 'adminModal') {
    adminModal.classList.add('hidden');
  }
});

document.getElementById('itemForm').addEventListener('submit', function (event) {
  event.preventDefault();
  otherItems.push({
    name: document.getElementById('itemName').value.trim(),
    category: document.getElementById('itemCategory').value,
    cost: Math.max(0, Number(document.getElementById('itemCost').value) || 0)
  });
  editorDirty = true;
  event.currentTarget.reset();
  renderAdmin();
  updateAdminUi();
});

document.getElementById('saveAdmin').addEventListener('click', async function () {
  if (!supabaseClient || !databaseConnected || !sharedPricesLoaded ||
      !adminSessionReady || !isAuthorized(adminUser) || pendingRemoteData) {
    adminStatus.textContent =
      'Sign in as the authorized admin and wait for shared prices to load.';
    return;
  }

  savingPrices = true;
  updateAdminUi();
  adminStatus.textContent = 'Saving shared prices…';

  const nextValues = {
    id: 1,
    costs: normalizeCosts(costs),
    items: normalizeItems(otherItems),
    updated_at: new Date().toISOString()
  };

  try {
    const result = await supabaseClient
      .from('upgrade_pricing')
      .upsert(nextValues, { onConflict: 'id' })
      .select('id, costs, items, updated_at')
      .single();

    if (result.error) {
      throw result.error;
    }

    editorDirty = false;
    pendingRemoteData = null;
    applySharedRow(result.data);
    adminStatus.textContent =
      'Prices saved. Connected devices receive the update automatically.';
  } catch (error) {
    adminStatus.textContent =
      'Could not save prices. Check the admin UID and Supabase policies. ' +
      error.message;
  } finally {
    savingPrices = false;
    updateAdminUi();
  }
});

document.getElementById('adminLoginForm').addEventListener('submit', async function (event) {
  event.preventDefault();

  if (!supabaseClient) {
    loginStatus.textContent = 'Supabase is not configured yet. Follow SETUP.md.';
    return;
  }

  const email = document.getElementById('adminEmail').value.trim();
  const password = document.getElementById('adminPassword').value;

  try {
    const result = await supabaseClient.auth.signInWithPassword({
      email: email,
      password: password
    });

    if (result.error) {
      throw result.error;
    }

    document.getElementById('adminPassword').value = '';
    loginStatus.textContent = 'Signed in.';
  } catch (error) {
    loginStatus.textContent =
      'Sign-in failed. Check the admin email and password, then try again.';
  }
});

document.getElementById('signOutAdmin').addEventListener('click', async function () {
  if (!supabaseClient) {
    return;
  }

  const result = await supabaseClient.auth.signOut();
  if (result.error) {
    adminStatus.textContent = 'Could not sign out: ' + result.error.message;
    return;
  }

  adminSessionReady = false;
  adminUser = null;
  editorDirty = false;
  pendingRemoteData = null;
  loginStatus.textContent = '';
  updateAdminUi();
});

document.getElementById('reloadShared').addEventListener('click', reloadLatestPrices);
document.querySelector('.admin-button').addEventListener('click', adminLogin);

initializeSupabase();
calculateUpgrade();

