import { api } from './api-client.js';
import { registryConfig, demoGifts } from './registry-config.js?v=20261029-postgres';

const configured = !registryConfig.demoMode && Boolean(registryConfig.apiBaseUrl);
const loginPanel = document.querySelector('.login-panel');
const loginForm = document.querySelector('#admin-login-form');
const loginStatus = document.querySelector('.login-status');
const shell = document.querySelector('.admin-shell');
const editor = document.querySelector('.gift-editor');
const giftForm = document.querySelector('.gift-editor-form');
const panelStatus = document.querySelector('.panel-status');
const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

let gifts = [];
let orders = [];
let rsvps = [];

const formatMoney = (cents) => money.format(Number(cents || 0) / 100);
const parseMoney = (value) => {
  const number = Number(String(value).trim().replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(number) ? Math.round(number * 100) : 0;
};
const inputMoney = (cents) => (Number(cents || 0) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

for (const field of [giftForm.elements.price, giftForm.elements.minimum]) {
  field.addEventListener('input', () => {
    const digits = field.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
    field.value = digits ? inputMoney(Number(digits.slice(0, 9))) : '';
  });
}

function storageImage(path) {
  return path ? `${registryConfig.apiBaseUrl}/images/${path}` : '';
}

function showShell(email = 'Prévia local') {
  loginPanel.hidden = true;
  shell.hidden = false;
  document.querySelector('.admin-email').textContent = email;
  document.querySelector('.setup-notice').hidden = configured;
  renderAll();
}

function renderAll() {
  renderGifts();
  renderOrders();
  renderRsvps();
  document.querySelector('[data-stat="active"]').textContent = String(gifts.filter((gift) => gift.is_active !== false).length);
  const approved = orders.filter((order) => order.status === 'approved');
  document.querySelector('[data-stat="approved"]').textContent = String(approved.length);
  document.querySelector('[data-stat="revenue"]').textContent = formatMoney(approved.reduce((sum, order) => sum + order.amount_cents, 0));
}

function imageNode(gift) {
  const wrap = document.createElement('div');
  wrap.className = 'admin-gift-image';
  const url = gift.image_url || storageImage(gift.image_path);
  if (url) {
    const image = document.createElement('img');
    image.src = url;
    image.alt = '';
    image.loading = 'lazy';
    wrap.append(image);
  }
  return wrap;
}

function renderGifts() {
  const list = document.querySelector('.admin-gift-list');
  list.replaceChildren(...gifts.map((gift) => {
    const row = document.createElement('article');
    row.className = 'admin-gift';
    const main = document.createElement('div');
    main.className = 'admin-gift-main';
    const title = document.createElement('strong');
    title.textContent = gift.title;
    const category = document.createElement('span');
    category.textContent = gift.category;
    main.append(title, category);
    const meta = document.createElement('div');
    meta.className = 'admin-gift-meta';
    const price = document.createElement('strong');
    price.textContent = formatMoney(gift.price_cents);
    const mode = document.createElement('span');
    mode.textContent = gift.gift_mode === 'quota' ? 'Cotas' : gift.unlimited_purchases ? 'Compras ilimitadas' : `${gift.quantity_total} unidade(s)`;
    meta.append(price, mode);
    const state = document.createElement('span');
    state.className = `status-pill${gift.is_active === false ? ' inactive' : ''}`;
    state.textContent = gift.is_active === false ? 'Oculto' : 'Visível';
    const actions = document.createElement('div');
    actions.className = 'gift-actions';
    const edit = document.createElement('button');
    edit.type = 'button'; edit.textContent = 'Editar';
    edit.addEventListener('click', () => openEditor(gift));
    const toggle = document.createElement('button');
    toggle.type = 'button'; toggle.textContent = gift.is_active === false ? 'Ativar' : 'Ocultar';
    toggle.addEventListener('click', () => toggleGift(gift));
    const remove = document.createElement('button');
    remove.type = 'button'; remove.textContent = 'Excluir';
    remove.setAttribute('aria-label', `Excluir ${gift.title}`);
    remove.addEventListener('click', () => deleteGift(gift, remove));
    actions.append(edit, toggle, remove);
    row.append(imageNode(gift), main, meta, state, actions);
    return row;
  }));
  panelStatus.textContent = gifts.length ? '' : 'Nenhum presente cadastrado.';
}

function renderOrders() {
  const body = document.querySelector('.orders-body');
  const empty = document.querySelector('.orders-empty');
  empty.hidden = orders.length > 0;
  body.replaceChildren(...orders.map((order) => {
    const row = document.createElement('tr');
    const values = [
      `${order.guest_name}\n${order.guest_email}`,
      order.gifts?.title || 'Presente',
      formatMoney(order.amount_cents),
      ({ created: 'Criado', approved: 'Aprovado', pending: 'Pendente', rejected: 'Recusado', cancelled: 'Cancelado', refunded: 'Estornado', expired: 'Expirado', review: 'Revisar' })[order.status] || order.status,
      order.payment_method || '—',
      order.guest_message || '—',
      new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(order.created_at))
    ];
    values.forEach((value) => { const cell = document.createElement('td'); cell.textContent = value; row.append(cell); });
    return row;
  }));
}

function updateModeFields() {
  const quota = giftForm.elements.giftMode.value === 'quota';
  const unlimited = !quota && giftForm.elements.unlimitedPurchases.checked;
  document.querySelector('.minimum-field').hidden = !quota;
  document.querySelector('.quantity-field').hidden = quota || unlimited;
  document.querySelector('.repeatable-field').hidden = quota;
  giftForm.elements.minimum.required = quota;
  giftForm.elements.quantity.required = !quota && !unlimited;
}

function openEditor(gift = null) {
  giftForm.reset();
  giftForm.elements.id.value = gift?.id || '';
  giftForm.elements.imagePath.value = gift?.image_path || '';
  giftForm.elements.title.value = gift?.title || '';
  const category = giftForm.elements.category;
  category.querySelector('[data-legacy-category]')?.remove();
  if (gift?.category && !Array.from(category.options).some(option => option.value === gift.category)) {
    const option = new Option(gift.category, gift.category);
    option.dataset.legacyCategory = 'true';
    category.add(option);
  }
  category.value = gift?.category || '';
  giftForm.elements.giftMode.value = gift?.gift_mode || 'unit';
  giftForm.elements.price.value = gift ? inputMoney(gift.price_cents) : '';
  giftForm.elements.minimum.value = gift?.minimum_contribution_cents ? inputMoney(gift.minimum_contribution_cents) : '';
  giftForm.elements.quantity.value = gift?.quantity_total || 1;
  giftForm.elements.unlimitedPurchases.checked = gift?.unlimited_purchases === true;
  giftForm.elements.sortOrder.value = gift?.sort_order || 0;
  giftForm.elements.description.value = gift?.description || '';
  giftForm.elements.isActive.checked = gift?.is_active !== false;
  editor.querySelector('#editor-title').textContent = gift ? 'Editar presente' : 'Novo presente';
  editor.querySelector('.editor-status').textContent = '';
  updateModeFields();
  editor.showModal();
}

async function toggleGift(gift) {
  if (!configured) {
    panelStatus.textContent = 'Conecte a API para alterar os presentes.';
    return;
  }
  try {
    await api('/admin/gifts/' + gift.id, { method: 'PATCH', body: { is_active: gift.is_active === false } });
    await loadDashboard();
  } catch { panelStatus.textContent = 'Não foi possível alterar este presente.'; }
}

function renderRsvps() {
  document.querySelector('[data-rsvp-stat="total"]').textContent = String(rsvps.length);
  document.querySelector('[data-rsvp-stat="yes"]').textContent = String(rsvps.filter(item => item.attending).reduce((total, item) => total + 1 + (item.companions?.length || 0), 0));
  document.querySelector('[data-rsvp-stat="no"]').textContent = String(rsvps.filter((item) => !item.attending).length);
  document.querySelector('.rsvp-empty').hidden = rsvps.length > 0;
  document.querySelector('.rsvp-body').replaceChildren(...rsvps.map((response) => {
    const row = document.createElement('tr');
    const values = [
      response.guest_name,
      response.attending ? 'Sim' : 'Não',
      response.companions?.join(', ') || '—',
      response.guest_message || '—',
      new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(response.created_at))
    ];
    values.forEach((value) => {
      const cell = document.createElement('td');
      cell.textContent = value;
      row.append(cell);
    });
    return row;
  }));
}

async function deleteGift(gift, button) {
  if (!configured) {
    panelStatus.textContent = 'Conecte a API para excluir presentes.';
    return;
  }
  if (!window.confirm(`Excluir "${gift.title}" da lista? Se houver pedidos vinculados, o presente será arquivado para preservar o histórico de pagamentos.`)) return;

  button.disabled = true;
  panelStatus.textContent = 'Excluindo presente...';
  try {
    await api('/admin/gifts/' + gift.id, { method: 'DELETE' });
    await loadDashboard();
  } catch (error) {
    console.error(error);
    panelStatus.textContent = 'Não foi possível excluir este presente. Tente novamente.';
    button.disabled = false;
  }
}

async function uploadImage(file) {
  if (!file?.size) return null;
  if (file.size > 4 * 1024 * 1024) throw new Error('A imagem deve ter no máximo 4 MB.');
  const result = await api('/admin/images', { method: 'POST', body: file, raw: true });
  return result.path;
}

giftForm.elements.giftMode.addEventListener('change', updateModeFields);
giftForm.elements.unlimitedPurchases.addEventListener('change', updateModeFields);
giftForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!giftForm.reportValidity()) return;
  const status = editor.querySelector('.editor-status');
  if (!configured) {
    status.textContent = 'A prévia não salva dados. Conecte a API para liberar o cadastro.';
    return;
  }
  const button = giftForm.querySelector('.save-gift-button');
  button.disabled = true;
  status.textContent = 'Salvando...';
  try {
    const mode = giftForm.elements.giftMode.value;
    const price = parseMoney(giftForm.elements.price.value);
    const minimum = mode === 'quota' ? parseMoney(giftForm.elements.minimum.value) : null;
    if (price < 1 || (mode === 'quota' && (minimum < 1 || minimum > price))) {
      throw new Error('Confira o valor total e a contribuição mínima. O mínimo aceito é R$ 0,01.');
    }
    const newImage = await uploadImage(giftForm.elements.image.files[0]);
    const payload = {
      title: giftForm.elements.title.value.trim(),
      category: giftForm.elements.category.value.trim(),
      description: giftForm.elements.description.value.trim(),
      gift_mode: mode,
      price_cents: price,
      minimum_contribution_cents: minimum,
      quantity_total: mode === 'unit' ? Number(giftForm.elements.quantity.value) : 1,
      unlimited_purchases: mode === 'unit' && giftForm.elements.unlimitedPurchases.checked,
      sort_order: Number(giftForm.elements.sortOrder.value),
      image_path: newImage || giftForm.elements.imagePath.value || null,
      is_active: giftForm.elements.isActive.checked
    };
    const id = giftForm.elements.id.value;
    await api('/admin/gifts' + (id ? '/' + id : ''), { method: id ? 'PATCH' : 'POST', body: payload });
    editor.close();
    await loadDashboard();
  } catch (error) {
    console.error(error);
    status.textContent = error.message || 'Não foi possível salvar o presente.';
  } finally {
    button.disabled = false;
  }
});

document.querySelector('.new-gift-button').addEventListener('click', () => openEditor());
document.querySelector('.export-button').addEventListener('click', () => {
  if (!orders.length) {
    document.querySelector('.orders-empty').textContent = 'Não há pagamentos para exportar.';
    return;
  }
  const columns = ['Nome', 'E-mail', 'Presente', 'Valor', 'Status', 'Forma de pagamento', 'Mensagem', 'Criado em', 'Pago em'];
  // Texto dos convidados que começa com = + - @ vira fórmula no Excel; o apóstrofo o neutraliza.
  const escapeCsv = (value) => {
    const text = String(value ?? '');
    const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  const lines = orders.map((order) => [
    order.guest_name, order.guest_email, order.gifts?.title || '',
    (order.amount_cents / 100).toFixed(2).replace('.', ','), order.status,
    order.payment_method || '', order.guest_message || '', order.created_at, order.paid_at || ''
  ].map(escapeCsv).join(';'));
  const blob = new Blob([`\uFEFF${columns.map(escapeCsv).join(';')}\n${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `presentes-lais-levy-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
});
document.querySelector('.editor-close').addEventListener('click', () => editor.close());
editor.addEventListener('click', (event) => { if (event.target === editor) editor.close(); });
document.querySelectorAll('.nav-button').forEach((button) => button.addEventListener('click', () => {
  document.querySelectorAll('.nav-button').forEach((item) => item.classList.toggle('active', item === button));
  document.querySelectorAll('[data-view-panel]').forEach((panel) => { panel.hidden = panel.dataset.viewPanel !== button.dataset.view; });
}));
document.querySelector('.refresh-rsvp-button').addEventListener('click', async () => {
  const status = document.querySelector('.rsvp-panel-status');
  status.textContent = 'Atualizando respostas...';
  try {
    const data = await api('/admin/dashboard');
    rsvps = data.rsvps;
    renderRsvps();
    status.textContent = 'Respostas atualizadas.';
  } catch (error) {
    console.error(error);
    status.textContent = 'Não foi possível atualizar as respostas.';
  }
});

async function loadDashboard() {
  const data = await api('/admin/dashboard');
  gifts = data.gifts;
  orders = data.orders;
  rsvps = data.rsvps;
  renderAll();
}

async function openAuthenticatedPanel(user) {
  showShell(user.email);
  try { await loadDashboard(); } catch { panelStatus.textContent = 'Não foi possível carregar o painel.'; }
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  loginStatus.textContent = 'Entrando...';
  const button = loginForm.querySelector('button');
  button.disabled = true;
  try {
    const user = await api('/login', { method: 'POST', body: {
      email: loginForm.elements.email.value, password: loginForm.elements.password.value
    } });
    loginForm.reset();
    await openAuthenticatedPanel(user);
  } catch { loginStatus.textContent = 'Não foi possível entrar. Confira e-mail e senha e tente novamente.'; }
  finally { button.disabled = false; }
});

document.querySelector('.logout-button').addEventListener('click', async () => {
  try { await api('/logout', { method: 'POST' }); location.reload(); }
  catch { panelStatus.textContent = 'Não foi possível sair. Tente novamente.'; }
});

window.addEventListener('admin-session-expired', () => {
  // A sessão dura 8 horas. Recarregar leva de volta à tela de entrada.
  alert('Sua sessão expirou. Entre novamente para continuar.');
  location.reload();
});

async function initialize() {
  if (!configured) {
    gifts = demoGifts.map(gift => ({ ...gift, is_active: true }));
    showShell();
    return;
  }
  try { await openAuthenticatedPanel(await api('/session')); }
  catch (error) { if (error.message !== 'authentication_required') throw error; }
}
initialize().catch(() => { loginStatus.textContent = 'Não foi possível iniciar o painel.'; });
