const menuButton = document.querySelector('.menu-toggle');
import { registryConfig } from './registry-config.js?v=20261029-postgres';

const menu = document.querySelector('#main-nav');
function closeMenu() {
  menu.classList.remove('open');
  menuButton.setAttribute('aria-expanded', 'false');
  menuButton.setAttribute('aria-label', 'Abrir menu');
}
menuButton.addEventListener('click', () => {
  const open = menuButton.getAttribute('aria-expanded') !== 'true';
  menu.classList.toggle('open', open);
  menuButton.setAttribute('aria-expanded', String(open));
  menuButton.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
});
menu.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && menu.classList.contains('open')) {
    closeMenu();
    menuButton.focus();
  }
});
matchMedia('(min-width: 741px)').addEventListener('change', closeMenu);
document.querySelectorAll('details').forEach(item => item.addEventListener('toggle', () => {
  if (item.open) document.querySelectorAll('details[open]').forEach(other => {
    if (other !== item) other.open = false;
  });
}));
const form = document.querySelector('.rsvp-form');
const status = document.querySelector('.form-status');
const rsvpButton = form.querySelector('.submit-button');
let rsvpTurnstileToken = '';
let rsvpTurnstileWidget = null;
let rsvpVerificationError = '';
let rsvpSubmissionKey = crypto.randomUUID();
const companionsField = form.querySelector('.rsvp-companions');
function updateCompanions() {
  const declined = form.elements.presenca.value === 'nao';
  companionsField.hidden = declined;
  form.elements.acompanhantes.disabled = declined;
}
form.addEventListener('change', updateCompanions);

form.addEventListener('submit', async event => {
  event.preventDefault();
  status.textContent = '';
  if (!form.checkValidity()) {
    status.textContent = 'Preencha seu nome e escolha uma opção de presença.';
    form.reportValidity();
    return;
  }
  if (!rsvpTurnstileToken) {
    status.textContent = rsvpVerificationError || 'Aguarde a verificação de segurança. Se ela não aparecer, permita seu carregamento no navegador e atualize a página.';
    return;
  }
  const data = Object.fromEntries(new FormData(form));
  const companions = data.presenca === 'sim' ? String(data.acompanhantes || '').split(/\r?\n/).map(name => name.trim()).filter(Boolean) : [];
  if (companions.length > 20 || companions.some(name => name.length < 2 || name.length > 120)) {
    status.textContent = 'Informe um nome por linha, com 2 a 120 caracteres. Para mais de 20 acompanhantes, fale com os noivos.';
    form.elements.acompanhantes.focus();
    return;
  }
  if (data.nome.trim().length < 2) {
    status.textContent = 'Informe seu nome completo para confirmar.';
    form.elements.nome.focus();
    return;
  }
  rsvpButton.disabled = true;
  status.textContent = 'Registrando sua resposta...';
  try {
    const response = await fetch(`${registryConfig.apiBaseUrl}/submit-rsvp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        submissionKey: rsvpSubmissionKey,
        name: data.nome.trim(),
        attending: data.presenca === 'sim',
        companions,
        turnstileToken: rsvpTurnstileToken
      })
    });
    const result = await response.json();
    if (!response.ok || !result.recorded) throw new Error(result.error || 'submission_failed');
    status.textContent = data.presenca === 'sim'
      ? `Presença confirmada, ${data.nome.trim()}! Esperamos você.`
      : `Resposta registrada, ${data.nome.trim()}. Obrigado por avisar!`;
    form.reset();
    updateCompanions();
    rsvpSubmissionKey = crypto.randomUUID();
  } catch (error) {
    console.error('RSVP submission failed', error);
    status.textContent = error.message?.startsWith('human_verification')
      ? 'A verificação expirou. Conclua novamente e tente enviar.'
      : 'Não foi possível confirmar agora. Tente novamente em instantes.';
  } finally {
    rsvpButton.disabled = false;
    rsvpTurnstileToken = '';
    if (rsvpTurnstileWidget !== null && window.turnstile) window.turnstile.reset(rsvpTurnstileWidget);
  }
});

function loadRsvpTurnstile() {
  if (!registryConfig.turnstileSiteKey) {
    status.textContent = 'A confirmação está temporariamente indisponível.';
    return;
  }
  window.onRsvpTurnstileLoad = () => {
    rsvpTurnstileWidget = window.turnstile.render('.rsvp-turnstile', {
      sitekey: registryConfig.turnstileSiteKey,
      language: 'pt-br',
      theme: 'light',
      size: window.innerWidth <= 390 ? 'compact' : 'flexible',
      callback: token => {
        rsvpTurnstileToken = token;
        rsvpVerificationError = '';
        status.textContent = 'Verificação concluída. Você já pode enviar sua resposta.';
      },
      'expired-callback': () => {
        rsvpTurnstileToken = '';
        rsvpVerificationError = 'A verificação expirou. Conclua novamente antes de enviar.';
        status.textContent = rsvpVerificationError;
      },
      'error-callback': code => {
        rsvpTurnstileToken = '';
        rsvpVerificationError = String(code) === '110200'
          ? 'Este endereço não está autorizado para a verificação de segurança. Avise os noivos.'
          : 'Não foi possível concluir a verificação de segurança. Permita seu carregamento no navegador e atualize a página.';
        status.textContent = rsvpVerificationError;
        console.warn('Falha na verificação de segurança:', code);
      }
    });
  };
  const script = document.createElement('script');
  script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=onRsvpTurnstileLoad';
  script.async = true;
  script.defer = true;
  script.onerror = () => {
    rsvpVerificationError = 'Não foi possível carregar a verificação. Permita seu carregamento no navegador e atualize a página.';
    status.textContent = rsvpVerificationError;
  };
  document.head.append(script);
}
loadRsvpTurnstile();

const header = document.querySelector('.site-header');
let headerFrame = 0;
function updateHeaderSize() {
  // Separate thresholds prevent flickering near the changeover point.
  if (window.scrollY > 64) header.classList.add('is-compact');
  else if (window.scrollY < 20) header.classList.remove('is-compact');
  headerFrame = 0;
}
window.addEventListener('scroll', () => {
  if (!headerFrame) headerFrame = requestAnimationFrame(updateHeaderSize);
}, { passive: true });
window.addEventListener('pageshow', updateHeaderSize);
updateHeaderSize();

// Configure data-wedding-date with an ISO date including its UTC offset.
// Leave empty until the couple confirms the ceremony date and time.
const countdown = document.querySelector('.countdown');
if (countdown) {
  const configuredDate = countdown.dataset.weddingDate;
  const targetTime = Date.parse(configuredDate);
  if (Number.isFinite(targetTime)) {
    const clock = countdown.querySelector('.countdown-clock');
    const complete = countdown.querySelector('.countdown-complete');
    const fields = Object.fromEntries([...clock.querySelectorAll('[data-countdown]')]
      .map(element => [element.dataset.countdown, element]));
    countdown.querySelector('.countdown-date').textContent = new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Fortaleza'
    }).format(new Date(targetTime)) + ' · Aracati/CE';
    let countdownInterval;
    function updateCountdown() {
      const remaining = Math.max(0, Math.ceil((targetTime - Date.now()) / 1000));
      const values = {
        days: Math.floor(remaining / 86400),
        hours: Math.floor(remaining / 3600) % 24,
        minutes: Math.floor(remaining / 60) % 60,
        seconds: remaining % 60
      };
      for (const [key, value] of Object.entries(values)) {
        fields[key].textContent = String(value).padStart(2, '0');
      }
      clock.hidden = remaining === 0;
      complete.hidden = remaining !== 0;
      if (remaining === 0) clearInterval(countdownInterval);
    }
    updateCountdown();
    if (targetTime > Date.now()) countdownInterval = setInterval(updateCountdown, 1000);
    document.addEventListener('visibilitychange', updateCountdown);
  }
}

const carousel = document.querySelector('.story-carousel');
if (carousel) {
  const track = carousel.querySelector('.story-carousel-track');
  const slides = [...carousel.querySelectorAll('.story-photo')];
  const previous = carousel.querySelector('.carousel-previous');
  const next = carousel.querySelector('.carousel-next');
  const position = carousel.querySelector('.carousel-position span');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let activeSlide = 0;
  let autoplay;

  const realCount = slides.length;
  const firstClone = slides[0].cloneNode(true);
  firstClone.setAttribute('aria-hidden', 'true');
  firstClone.querySelector('img').alt = '';
  firstClone.querySelector('img').removeAttribute('loading');
  track.append(firstClone);
  let index = 0;

  function render(animate) {
    track.style.transition = animate ? '' : 'none';
    track.style.setProperty('transform', `translateX(-${index * 100}%)`, 'important');
    activeSlide = index % realCount;
    position.textContent = String(activeSlide + 1).padStart(2, '0');
    slides.forEach((slide, slideIndex) => {
      slide.setAttribute('aria-hidden', String(slideIndex !== activeSlide));
    });
  }

  function showSlide(target) {
    if (target < 0) {
      index = realCount;
      render(false);
      track.offsetWidth;
      index = realCount - 1;
    } else {
      index = target;
    }
    render(true);
  }

  track.addEventListener('transitionend', event => {
    if (event.target === track && index >= realCount) {
      index = 0;
      render(false);
    }
  });

  function stopAutoplay() {
    clearInterval(autoplay);
  }

  function startAutoplay() {
    stopAutoplay();
    if (!document.hidden && !reducedMotion.matches && slides.length > 1) {
      autoplay = setInterval(() => showSlide(index + 1), 4000);
    }
  }

  previous.addEventListener('click', () => {
    showSlide(index - 1);
    startAutoplay();
  });
  next.addEventListener('click', () => {
    showSlide(index + 1);
    startAutoplay();
  });
  carousel.addEventListener('mouseenter', stopAutoplay);
  carousel.addEventListener('mouseleave', startAutoplay);
  carousel.addEventListener('focusin', stopAutoplay);
  carousel.addEventListener('focusout', event => {
    if (!carousel.contains(event.relatedTarget)) startAutoplay();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopAutoplay();
    else startAutoplay();
  });
  reducedMotion.addEventListener('change', startAutoplay);
  render(false);
  startAutoplay();
}

