const STEPS = ['Welcome', 'Business', 'Branch', 'Admin', 'Finish'];

let currentStep = 0;
let branchesCache = [];
let skipAdminStep = false;
const state = {
  businessName: '',
  timezone: 'Africa/Dar_es_Salaam',
  currency: 'TZS',
  branchId: '',
  branchName: '',
  branchCity: '',
  adminEmail: '',
  adminPassword: '',
  adminSaved: false,
};

const content = document.getElementById('wizard-content');
const btnBack = document.getElementById('btn-back');
const btnNext = document.getElementById('btn-next');
const stepIndicator = document.getElementById('step-indicator');

function api() {
  return window.desktop;
}

function showMsg(html, type = 'ok') {
  return `<div class="msg ${type}">${html}</div>`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function branchDisplayName(branch) {
  return branch.branchName || branch.businessName || branch.branchId;
}

function branchListLabel(branch) {
  return `${branch.branchId} — ${branchDisplayName(branch)}`;
}

function deriveBranchCity(branch) {
  const name = branch.branchName || '';
  const dash = name.indexOf(' — ');
  if (dash > 0) return name.slice(0, dash).trim();
  const firstLine = (branch.locationDescription || '').split('\n')[0].trim();
  if (firstLine && firstLine.length <= 80) return firstLine;
  return name || '';
}

function applyBranchToState(branch) {
  if (!branch) return;
  state.branchId = branch.branchId || '';
  state.branchName = branchDisplayName(branch);
  state.branchCity = deriveBranchCity(branch);
  if (!state.businessName?.trim() && branch.businessName?.trim()) {
    state.businessName = branch.businessName.trim();
  }
}

function applyBranchToForm(branch) {
  applyBranchToState(branch);
  const branchIdEl = document.getElementById('branchId');
  const branchNameEl = document.getElementById('branchName');
  const branchCityEl = document.getElementById('branchCity');
  if (branchIdEl) branchIdEl.value = state.branchId;
  if (branchNameEl) branchNameEl.value = state.branchName;
  if (branchCityEl) branchCityEl.value = state.branchCity;
  document.querySelectorAll('[data-branch-id]').forEach(el => {
    el.classList.toggle('branch-pick--active', el.dataset.branchId === state.branchId);
  });
}

async function fetchBranches() {
  const branches = await api().listBranches();
  if (!Array.isArray(branches)) return [];
  branchesCache = branches;
  return branches;
}

async function refreshAdminSkipFlag() {
  try {
    const status = await api().getAdminSetupStatus();
    skipAdminStep = Boolean(status?.hasUsers);
    if (skipAdminStep && Array.isArray(status.users) && status.users[0]?.email) {
      state.adminEmail = status.users[0].email;
      state.adminSaved = true;
    }
  } catch {
    skipAdminStep = false;
  }
}

async function loadWizardState() {
  try {
    await api().seedDefaults();
  } catch {
    // Backend may still be starting; wizard steps retry API calls.
  }

  try {
    const cfg = await api().getConfig();
    if (cfg.businessName) state.businessName = cfg.businessName;
    if (cfg.branchId) state.branchId = cfg.branchId;
    if (cfg.branchName) state.branchName = cfg.branchName;

    await refreshAdminSkipFlag();

    const branches = await fetchBranches();
    if (branches.length === 0) return;

    const selected =
      branches.find(b => b.branchId === state.branchId) || (!state.branchId ? branches[0] : null);
    if (selected) applyBranchToState(selected);
  } catch {
    // Wizard still works with manual entry.
  }
}

function renderBranchPicker(branches) {
  const listEl = document.getElementById('branch-list');
  if (!listEl) return;

  if (!Array.isArray(branches) || branches.length === 0) {
    listEl.innerHTML = showMsg('No branches yet — enter details below to create your first branch.', 'warn');
    return;
  }

  listEl.innerHTML = branches
    .map(
      branch => `
      <button type="button" class="branch-pick${branch.branchId === state.branchId ? ' branch-pick--active' : ''}" data-branch-id="${escapeHtml(branch.branchId)}">
        ${escapeHtml(branchListLabel(branch))}
      </button>`,
    )
    .join('');

  listEl.querySelectorAll('[data-branch-id]').forEach(btn => {
    btn.onclick = () => {
      const branch = branches.find(b => b.branchId === btn.dataset.branchId);
      applyBranchToForm(branch);
    };
  });
}

async function saveAdminAccount(showResult) {
  const emailEl = document.getElementById('adminEmail');
  const passwordEl = document.getElementById('adminPassword');
  const resultEl = document.getElementById('admin-result');
  state.adminEmail = emailEl?.value?.trim() || state.adminEmail;
  const password = passwordEl?.value || '';

  if (!state.adminEmail) throw new Error('Admin email is required.');
  if (password.length < 8) throw new Error('Password must be at least 8 characters.');

  const res = await api().createAdmin({ email: state.adminEmail, password, name: 'Admin' });
  state.adminSaved = true;
  skipAdminStep = true;
  await api().saveConfig({ adminEmail: state.adminEmail });

  if (showResult && resultEl) {
    resultEl.innerHTML = showMsg(res.message || 'Admin account saved. Use these credentials to sign in.', 'ok');
  }

  if (passwordEl) passwordEl.value = '';
  return res;
}

function renderIndicator() {
  const visibleSteps = skipAdminStep ? STEPS.filter((_, i) => i !== 3) : STEPS;
  stepIndicator.innerHTML = visibleSteps
    .map((name, i) => {
      const stepIndex = skipAdminStep && i >= 3 ? i + 1 : i;
      let cls = '';
      if (stepIndex === currentStep) cls = 'active';
      else if (stepIndex < currentStep) cls = 'done';
      return `<span class="${cls}">${i + 1}. ${name}</span>`;
    })
    .join('');
}

async function renderFinishChecks() {
  const el = document.getElementById('finish-checks');
  if (!el) return;

  el.innerHTML = showMsg('Preparing your local CRM…');

  try {
    const cfg = await api().getConfig();
    const checks = await api().checkStorage();
    const storageOk = Object.values(checks).every(Boolean);

    let backendMsg = 'Starting local server…';
    try {
      let status = await api().getBackendStatus();
      if (status !== 'running') {
        await api().startBackend();
        status = await api().getBackendStatus();
      }
      backendMsg =
        status === 'running'
          ? 'Local server is running on this computer.'
          : 'Server is still starting — you can sign in in a moment.';
    } catch (err) {
      backendMsg = err.message || 'Could not verify server status.';
    }

    el.innerHTML = `
      <p>Everything runs locally — no database URL, port, or terminal setup.</p>
      <ul class="paths">
        <li class="ok">Data folder: <code>${escapeHtml(cfg.storagePath)}</code></li>
        <li class="${storageOk ? 'ok' : 'bad'}">Storage: ${storageOk ? 'ready' : 'check folder permissions'}</li>
        <li class="ok">${escapeHtml(backendMsg)}</li>
      </ul>
      <p class="hint">After sign-in, open <strong>Sessions</strong> to scan WhatsApp QR when you are ready.</p>
    `;
  } catch (err) {
    el.innerHTML = showMsg(err.message || 'Could not complete readiness checks', 'err');
  }
}

function render() {
  renderIndicator();
  btnBack.hidden = currentStep === 0;
  btnNext.textContent = currentStep === STEPS.length - 1 ? 'Sign in' : 'Next';

  if (currentStep === 0) {
    content.innerHTML = `
      <h2>Welcome</h2>
      <p>Install and run Inauzwa CRM on your computer with local WhatsApp.</p>
      <p>Your data is stored on this Mac automatically — no database or server configuration needed.</p>
      <p>This short wizard collects your business details and login (only if you do not have users yet).</p>
    `;
  } else if (currentStep === 1) {
    content.innerHTML = `
      <h2>Business Setup</h2>
      <label for="businessName">Business name</label>
      <input id="businessName" value="${escapeHtml(state.businessName)}" />
      <label for="timezone">Timezone</label>
      <input id="timezone" value="${escapeHtml(state.timezone)}" />
      <label for="currency">Currency</label>
      <input id="currency" value="${escapeHtml(state.currency)}" />
    `;
  } else if (currentStep === 2) {
    content.innerHTML = `
      <h2>Branch Setup</h2>
      <p class="hint">Pick a branch or enter details for your first location.</p>
      <div id="branch-list">${showMsg('Loading branches…')}</div>
      <label for="branchId">Branch ID (slug)</label>
      <input id="branchId" value="${escapeHtml(state.branchId)}" placeholder="dar" />
      <label for="branchName">Branch name</label>
      <input id="branchName" value="${escapeHtml(state.branchName)}" />
      <label for="branchCity">Branch city</label>
      <input id="branchCity" value="${escapeHtml(state.branchCity)}" />
    `;
    void fetchBranches()
      .then(branches => {
        if (branches.length > 0 && !state.branchId) {
          applyBranchToState(branches[0]);
          applyBranchToForm(branches[0]);
        } else if (state.branchId) {
          const match = branches.find(b => b.branchId === state.branchId);
          if (match) applyBranchToState(match);
        }
        const branchIdEl = document.getElementById('branchId');
        const branchNameEl = document.getElementById('branchName');
        const branchCityEl = document.getElementById('branchCity');
        if (branchIdEl) branchIdEl.value = state.branchId;
        if (branchNameEl) branchNameEl.value = state.branchName;
        if (branchCityEl) branchCityEl.value = state.branchCity;
        renderBranchPicker(branches);
      })
      .catch(err => {
        const listEl = document.getElementById('branch-list');
        if (listEl) listEl.innerHTML = showMsg(err.message || 'Could not load branches', 'err');
      });
  } else if (currentStep === 3) {
    content.innerHTML = `
      <h2>Admin Account</h2>
      <p>Create the login you will use in the app. If users already exist, you can continue without changes.</p>
      <div id="admin-result">${showMsg('Checking for existing users…')}</div>
      <label for="adminEmail">Admin email</label>
      <input id="adminEmail" type="email" value="${escapeHtml(state.adminEmail)}" autocomplete="username" />
      <label for="adminPassword">Admin password</label>
      <input id="adminPassword" type="password" value="" autocomplete="new-password" placeholder="At least 8 characters" />
      <button type="button" id="btn-save-admin" class="primary" style="margin-top:12px">Save admin account</button>
    `;
    document.getElementById('btn-save-admin').onclick = async () => {
      const btn = document.getElementById('btn-save-admin');
      btn.disabled = true;
      try {
        await saveAdminAccount(true);
      } catch (e) {
        const resultEl = document.getElementById('admin-result');
        if (resultEl) resultEl.innerHTML = showMsg(e.message || 'Could not save admin account', 'err');
      } finally {
        btn.disabled = false;
      }
    };
    void refreshAdminSkipFlag().then(() => {
      const resultEl = document.getElementById('admin-result');
      if (!resultEl) return;
      if (skipAdminStep && state.adminEmail) {
        resultEl.innerHTML = showMsg(
          `Existing user: ${escapeHtml(state.adminEmail)}. Click Next to continue, or set a new password and Save.`,
          'ok',
        );
        return;
      }
      resultEl.innerHTML = showMsg('No users yet — enter email and password, then Save admin account.', 'warn');
    });
  } else if (currentStep === 4) {
    content.innerHTML = `
      <h2>Ready</h2>
      <div id="finish-checks">${showMsg('Checking local setup…')}</div>
    `;
    void renderFinishChecks();
  }
}

async function saveStepData() {
  if (currentStep === 1) {
    state.businessName = document.getElementById('businessName').value.trim();
    state.timezone = document.getElementById('timezone').value.trim();
    state.currency = document.getElementById('currency').value.trim();
    await api().saveConfig({ businessName: state.businessName });
  } else if (currentStep === 2) {
    state.branchId = document.getElementById('branchId').value.trim().toLowerCase().replace(/\s+/g, '-');
    state.branchName = document.getElementById('branchName').value.trim();
    state.branchCity = document.getElementById('branchCity').value.trim();
    await api().saveConfig({ branchId: state.branchId, branchName: state.branchName });
    await api().setupBranch({
      branchId: state.branchId,
      businessName: state.businessName,
      branchName: state.branchName,
      locationDescription: state.branchCity,
      currency: state.currency,
    });
  } else if (currentStep === 3) {
    state.adminEmail = document.getElementById('adminEmail')?.value?.trim() || state.adminEmail;
    const password = document.getElementById('adminPassword')?.value || '';

    if (password.trim()) {
      await saveAdminAccount(false);
      return;
    }

    await refreshAdminSkipFlag();
    if (!skipAdminStep && !state.adminSaved) {
      throw new Error('Save an admin account first so you can sign in after setup.');
    }

    if (state.adminEmail) {
      await api().saveConfig({ adminEmail: state.adminEmail });
    }
  }
}

function stepBack() {
  if (currentStep <= 0) return;
  if (currentStep === 4 && skipAdminStep) {
    currentStep = 2;
  } else {
    currentStep -= 1;
  }
  render();
}

function stepForward() {
  if (currentStep === 2 && skipAdminStep) {
    currentStep = 4;
  } else {
    currentStep += 1;
  }
  render();
}

btnBack.onclick = () => stepBack();

btnNext.onclick = async () => {
  btnNext.disabled = true;
  try {
    if (currentStep === 2) {
      const branchId = document.getElementById('branchId')?.value?.trim();
      if (!branchId) {
        alert('Branch ID is required.');
        return;
      }
    }
    await saveStepData();
    if (currentStep === STEPS.length - 1) {
      await api().completeSetup();
      return;
    }
    stepForward();
  } catch (e) {
    alert(e.message || 'Step failed');
  } finally {
    btnNext.disabled = false;
  }
};

render();

void loadWizardState().then(() => {
  renderIndicator();
  if (currentStep === 2) render();
});
