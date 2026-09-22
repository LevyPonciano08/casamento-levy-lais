import { registryConfig, demoGifts } from './registry-config.js?v=20260922-turnstile';

const grid = document.querySelector('.gift-grid');
const catalogStatus = document.querySelector('.catalog-status');
const filters = document.querySelector('.category-filters');
const dialog = document.querySelector('.gift-dialog');
const form = document.querySelector('.gift-form');
const formStatus = document.querySelector('.form-status');
const demoNotice = document.querySelector('#demo-notice');
let gifts = [];
let activeCategory = 'Todos';
let turnstileToken = '';
let turnstileWidgetId = null;

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const formatMoney = (cents) => money.format(Number(cents) / 100);

function storageImage(path) {
  if (!path || !registryConfig.supabaseUrl) return '';
  return `${registryConfig.supabaseUrl}/storage/v1/object/public/gift-images/${path}`;
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function createGiftCard(gift, index) {
  const card = element('article', 'gift-card');
  const imageWrap = element('div', 'gift-image');
  const imageUrl = gift.image_url || storageImage(gift.image_path);
  if (imageUrl) {
    const image = document.createElement('img');
    image.src = imageUrl;
    image.alt = '';
    image.loading = 'lazy';
    image.decoding = 'async';
    imageWrap.append(image);
  } else {
    const placeholder = element('div', 'gift-placeholder');
    placeholder.append(element('span', 'monogram'));
    imageWrap.append(placeholder);
  }
  imageWrap.append(element('span', 'gift-number', String(index + 1).padStart(2, '0')));

  const body = element('div', 'gift-body');
  body.append(element('p', 'gift-category', gift.category));
  body.append(element('h3', 'gift-title', gift.title));
  if (gift.description) body.append(element('p', 'gift-description', gift.description));

  if (gift.gift_mode === 'quota') {
    const used = Math.max(0, gift.price_cents - gift.remaining_amount_cents);
    const progress = element('div', 'gift-progress');
    const bar = document.createElement('span');
    bar.style.width = `${Math.min(100, Math.round(used / gift.price_cents * 100))}%`;
    progress.append(bar);
    body.append(progress, element('p', 'gift-remaining', `${formatMoney(gift.remaining_amount_cents)} ainda disponíveis`));
  }

  const row = element('div', 'gift-price-row');
  const available = gift.gift_mode === 'quota' ? gift.remaining_amount_cents >= gift.minimum_contribution_cents : gift.available_quantity > 0;
  const priceText = gift.gift_mode === 'quota' ? `a partir de ${formatMoney(gift.minimum_contribution_cents)}` : formatMoney(gift.price_cents);
  row.append(element('span', 'gift-price', priceText));
  const button = element('button', 'gift-button', available ? 'Presentear →' : 'Já presenteado');
  button.type = 'button';
  button.disabled = !available;
  if (available) button.addEventListener('click', () => openGift(gift));
  row.append(button);
  body.append(row);
  card.append(imageWrap, body);
  return card;
}

function renderGifts() {
  const visible = activeCategory === 'Todos' ? gifts : gifts.filter((gift) => gift.category === activeCategory);
  grid.replaceChildren(...visible.map(createGiftCard));
  catalogStatus.hidden = true;
  if (!visible.length) {
    catalogStatus.hidden = false;
    catalogStatus.textContent = 'Nenhum presente disponível nesta categoria.';
  }
}

function renderFilters() {
  const categories = ['Todos', ...new Set(gifts.map((gift) => gift.category))];
  filters.replaceChildren(...categories.map((category) => {
    const button = element('button', 'filter-button', category);
    button.type = 'button';
    button.setAttribute('aria-pressed', String(category === activeCategory));
    button.addEventListener('click', () => {
      activeCategory = category;
      renderFilters();
      renderGifts();
    });
    return button;
  }));
}

function parseAmount(value) {
  const normalized = value.trim().replace(/\./g, '').replace(',', '.');
  const amount = Number(normalized);
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
}

function openGift(gift) {
  form.reset();
  formStatus.textContent = '';
  turnstileToken = '';
  if (turnstileWidgetId !== null && window.turnstile) window.turnstile.reset(turnstileWidgetId);
  form.elements.giftId.value = gift.id;
  dialog.querySelector('#dialog-title').textContent = gift.title;
  const contributionField = dialog.querySelector('.contribution-field');
  const quantityField = dialog.querySelector('.quantity-field');
  contributionField.hidden = gift.gift_mode !== 'quota';
  quantityField.hidden = gift.gift_mode !== 'unit' || gift.available_quantity <= 1;

  if (gift.gift_mode === 'quota') {
    form.elements.amount.value = (gift.minimum_contribution_cents / 100).toFixed(2).replace('.', ',');
    dialog.querySelector('.amount-help').textContent = `Mínimo ${formatMoney(gift.minimum_contribution_cents)} · disponível ${formatMoney(gift.remaining_amount_cents)}`;
    dialog.querySelector('.dialog-price').textContent = `Contribua a partir de ${formatMoney(gift.minimum_contribution_cents)}.`;
  } else {
    const options = Array.from({ length: Math.min(gift.available_quantity, 10) }, (_, index) => {
      const option = document.createElement('option');
      option.value = String(index + 1);
      option.textContent = String(index + 1);
      return option;
    });
    form.elements.quantity.replaceChildren(...options);
    dialog.querySelector('.dialog-price').textContent = `${formatMoney(gift.price_cents)} por unidade.`;
  }
  dialog.showModal();
  setTimeout(() => form.elements.guestName.focus(), 0);
}

dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', (event) => {
  if (event.target === dialog) dialog.close();
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  const gift = gifts.find((item) => item.id === form.elements.giftId.value);
  if (!gift) return;

  const amountCents = gift.gift_mode === 'quota' ? parseAmount(form.elements.amount.value) : null;
  if (gift.gift_mode === 'quota' && (amountCents < gift.minimum_contribution_cents || amountCents > gift.remaining_amount_cents)) {
    formStatus.textContent = `Escolha um valor entre ${formatMoney(gift.minimum_contribution_cents)} e ${formatMoney(gift.remaining_amount_cents)}.`;
    return;
  }
  if (registryConfig.demoMode) {
    formStatus.textContent = 'Esta é a prévia. O botão será liberado assim que as contas do Supabase e Mercado Pago forem conectadas.';
    return;
  }
  if (!registryConfig.turnstileSiteKey || !turnstileToken) {
    formStatus.textContent = 'Conclua a verificação de segurança para continuar.';
    return;
  }

  const submit = form.querySelector('.checkout-button');
  submit.disabled = true;
  formStatus.textContent = 'Preparando o pagamento seguro...';
  try {
    const endpoint = registryConfig.createCheckoutUrl || `${registryConfig.supabaseUrl}/functions/v1/create-checkout`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': registryConfig.supabasePublishableKey },
      body: JSON.stringify({
        giftId: gift.id,
        guestName: form.elements.guestName.value,
        guestEmail: form.elements.guestEmail.value,
        guestMessage: form.elements.guestMessage.value,
        publicName: form.elements.publicName.checked,
        amountCents,
        quantity: Number(form.elements.quantity.value || 1),
        turnstileToken
      })
    });
    const result = await response.json();
    if (!response.ok || !result.checkoutUrl) throw new Error(result.error || 'checkout_failed');
    location.assign(result.checkoutUrl);
  } catch (error) {
    console.error(error);
    formStatus.textContent = error.message === 'gift_not_available'
      ? 'Este presente acabou de ser escolhido por outra pessoa.'
      : error.message.startsWith('human_verification')
        ? 'A verificação de segurança expirou. Conclua novamente para continuar.'
        : 'Não foi possível abrir o pagamento agora. Tente novamente em alguns instantes.';
    submit.disabled = false;
    turnstileToken = '';
    if (turnstileWidgetId !== null && window.turnstile) window.turnstile.reset(turnstileWidgetId);
  }
});

function loadTurnstile() {
  if (registryConfig.demoMode || !registryConfig.turnstileSiteKey) return Promise.resolve();
  return new Promise((resolve, reject) => {
    window.onRegistryTurnstileLoad = () => {
      const container = document.querySelector('.turnstile-container');
      container.hidden = false;
      turnstileWidgetId = window.turnstile.render(container, {
        sitekey: registryConfig.turnstileSiteKey,
        language: 'pt-BR',
        theme: 'light',
        size: 'flexible',
        callback: (token) => { turnstileToken = token; },
        'expired-callback': () => { turnstileToken = ''; },
        'error-callback': () => { turnstileToken = ''; }
      });
      resolve();
    };
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=onRegistryTurnstileLoad';
    script.async = true;
    script.defer = true;
    script.onerror = reject;
    document.head.append(script);
  });
}

async function loadGifts() {
  if (registryConfig.demoMode) {
    demoNotice.hidden = false;
    gifts = [...demoGifts];
  } else {
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    const supabase = createClient(registryConfig.supabaseUrl, registryConfig.supabasePublishableKey);
    const { data, error } = await supabase.from('gift_catalog').select('*').order('sort_order').order('title');
    if (error) throw error;
    gifts = data ?? [];
  }
  renderFilters();
  renderGifts();
}

loadGifts().catch((error) => {
  console.error(error);
  catalogStatus.hidden = false;
  catalogStatus.textContent = 'Não foi possível carregar os presentes. Atualize a página em alguns instantes.';
});
loadTurnstile().catch((error) => console.error('Não foi possível carregar a verificação de segurança.', error));
