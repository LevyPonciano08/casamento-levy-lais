import { registryConfig, demoGifts } from './registry-config.js';

const configured = !registryConfig.demoMode && registryConfig.supabaseUrl && registryConfig.supabasePublishableKey;
const loginPanel = document.querySelector('.login-panel');
const loginForm = document.querySelector('.login-form');
const loginStatus = document.querySelector('.login-status');
const shell = document.querySelector('.admin-shell');
const editor = document.querySelector('.gift-editor');
const giftForm = document.querySelector('.gift-editor-form');
const panelStatus = document.querySelector('.panel-status');
const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
let supabase;
let sessionUser;
let gifts = [];
let orders = [];

const formatMoney = (cents) => money.format(Number(cents || 0) / 100);
const parseMoney = (value) => {
  const number = Number(String(value).trim().replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(number) ? Math.round(number * 100) : 0;
};
const inputMoney = (cents) => (Number(cents || 0) / 100).toFixed(2).replace('.', ',');

function storageImage(path) {
  return path && registryConfig.supabaseUrl ? `${registryConfig.supabaseUrl}/storage/v1/object/public/gift-images/${path}` : '';
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
    mode.textContent = gift.gift_mode === 'quota' ? 'Cotas' : `${gift.quantity_total} unidade(s)`;
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
    actions.append(edit, toggle);
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
  document.querySelector('.minimum-field').hidden = !quota;
  document.querySelector('.quantity-field').hidden = quota;
  giftForm.elements.minimum.required = quota;
  giftForm.elements.quantity.required = !quota;
}

function openEditor(gift = null) {
  giftForm.reset();
  giftForm.elements.id.value = gift?.id || '';
  giftForm.elements.imagePath.value = gift?.image_path || '';
  giftForm.elements.title.value = gift?.title || '';
  giftForm.elements.category.value = gift?.category || '';
  giftForm.elements.giftMode.value = gift?.gift_mode || 'unit';
  giftForm.elements.price.value = gift ? inputMoney(gift.price_cents) : '';
  giftForm.elements.minimum.value = gift?.minimum_contribution_cents ? inputMoney(gift.minimum_contribution_cents) : '';
  giftForm.elements.quantity.value = gift?.quantity_total || 1;
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
    panelStatus.textContent = 'Conecte o Supabase para alterar os presentes.';
    return;
  }
  const { error } = await supabase.from('gifts').update({ is_active: gift.is_active === false }).eq('id', gift.id);
  if (error) panelStatus.textContent = 'Não foi possível alterar este presente.';
  else await loadDashboard();
}

async function uploadImage(file) {
  if (!file?.size) return null;
  if (file.size > 5 * 1024 * 1024) throw new Error('A imagem deve ter no máximo 5 MB.');
  const extension = file.name.split('.').pop().toLowerCase();
  const path = `${sessionUser.id}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from('gift-images').upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return path;
}

giftForm.elements.giftMode.addEventListener('change', updateModeFields);
giftForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!giftForm.reportValidity()) return;
  const status = editor.querySelector('.editor-status');
  if (!configured) {
    status.textContent = 'A prévia não salva dados. Conecte o projeto Supabase para liberar o cadastro.';
    return;
  }
  const button = giftForm.querySelector('.save-gift-button');
  button.disabled = true;
  status.textContent = 'Salvando...';
  try {
    const mode = giftForm.elements.giftMode.value;
    const price = parseMoney(giftForm.elements.price.value);
    const minimum = mode === 'quota' ? parseMoney(giftForm.elements.minimum.value) : null;
    if (price < 500 || (mode === 'quota' && (minimum < 500 || minimum > price))) {
      throw new Error('Confira o valor total e a contribuição mínima. O mínimo aceito é R$ 5,00.');
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
      sort_order: Number(giftForm.elements.sortOrder.value),
      image_path: newImage || giftForm.elements.imagePath.value || null,
      is_active: giftForm.elements.isActive.checked
    };
    const id = giftForm.elements.id.value;
    const query = id
      ? supabase.from('gifts').update(payload).eq('id', id)
      : supabase.from('gifts').insert({ ...payload, created_by: sessionUser.id });
    const { error } = await query;
    if (error) throw error;
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
  const escapeCsv = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const lines = orders.map((order) => [
    order.guest_name, order.guest_email, order.gifts?.title || '',
    (order.amount_cents / 100).toFixed(2).replace('.', ','), order.status,
    order.payment_method || '', order.guest_message || '', order.created_at, order.paid_at || ''
  ].map(escapeCsv).join(';'));
  const blob = new Blob([`\uFEFF${columns.map(escapeCsv).join(';')}\n${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `presentes-levy-lais-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
});
document.querySelector('.editor-close').addEventListener('click', () => editor.close());
editor.addEventListener('click', (event) => { if (event.target === editor) editor.close(); });
document.querySelectorAll('.nav-button').forEach((button) => button.addEventListener('click', () => {
  document.querySelectorAll('.nav-button').forEach((item) => item.classList.toggle('active', item === button));
  document.querySelectorAll('[data-view-panel]').forEach((panel) => { panel.hidden = panel.dataset.viewPanel !== button.dataset.view; });
}));

async function loadDashboard() {
  const [giftResult, orderResult] = await Promise.all([
    supabase.from('gifts').select('*').order('sort_order').order('created_at'),
    supabase.from('gift_orders').select('*, gifts(title)').order('created_at', { ascending: false })
  ]);
  if (giftResult.error) throw giftResult.error;
  if (orderResult.error) throw orderResult.error;
  gifts = giftResult.data || [];
  orders = orderResult.data || [];
  renderAll();
}

async function openAuthenticatedPanel(user) {
  const { data, error } = await supabase.from('admin_users').select('user_id').eq('user_id', user.id).maybeSingle();
  if (error || !data) {
    await supabase.auth.signOut();
    loginStatus.textContent = 'Este usuário não possui acesso de administrador.';
    return;
  }
  sessionUser = user;
  showShell(user.email);
  try { await loadDashboard(); } catch (error) { console.error(error); panelStatus.textContent = 'Não foi possível carregar o painel.'; }
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!configured) {
    loginStatus.textContent = 'O acesso será liberado quando o projeto Supabase for conectado.';
    return;
  }
  loginStatus.textContent = 'Entrando...';
  const { data, error } = await supabase.auth.signInWithPassword({
    email: loginForm.elements.email.value,
    password: loginForm.elements.password.value
  });
  if (error) loginStatus.textContent = 'E-mail ou senha incorretos.';
  else await openAuthenticatedPanel(data.user);
});

document.querySelector('.logout-button').addEventListener('click', async () => {
  if (supabase) await supabase.auth.signOut();
  location.reload();
});

async function initialize() {
  if (!configured) {
    gifts = demoGifts.map((gift) => ({ ...gift, is_active: true }));
    loginPanel.hidden = true;
    showShell();
    return;
  }
  const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  supabase = createClient(registryConfig.supabaseUrl, registryConfig.supabasePublishableKey);
  const { data } = await supabase.auth.getSession();
  if (data.session?.user) await openAuthenticatedPanel(data.session.user);
}

initialize().catch((error) => {
  console.error(error);
  loginStatus.textContent = 'Não foi possível iniciar o painel.';
});
