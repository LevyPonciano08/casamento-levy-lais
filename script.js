const menuButton = document.querySelector('.menu-toggle');
import { registryConfig } from './registry-config.js?v=20260922-turnstile';

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
let rsvpSubmissionKey = crypto.randomUUID();

form.addEventListener('submit', async event => {
  event.preventDefault();
  status.textContent = '';
  if (!form.checkValidity()) {
    status.textContent = 'Preencha seu nome e escolha uma opção de presença.';
    form.reportValidity();
    return;
  }
  if (!rsvpTurnstileToken) {
    status.textContent = 'Conclua a verificação de segurança para confirmar.';
    return;
  }
  const data = Object.fromEntries(new FormData(form));
  if (data.nome.trim().length < 2) {
    status.textContent = 'Informe seu nome completo para confirmar.';
    form.elements.nome.focus();
    return;
  }
  rsvpButton.disabled = true;
  status.textContent = 'Registrando sua resposta...';
  try {
    const response = await fetch(`${registryConfig.supabaseUrl}/functions/v1/submit-rsvp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: registryConfig.supabasePublishableKey },
      body: JSON.stringify({
        submissionKey: rsvpSubmissionKey,
        name: data.nome.trim(),
        attending: data.presenca === 'sim',
        message: data.mensagem.trim(),
        turnstileToken: rsvpTurnstileToken
      })
    });
    const result = await response.json();
    if (!response.ok || !result.recorded) throw new Error(result.error || 'submission_failed');
    status.textContent = `Resposta registrada. Obrigado, ${data.nome.trim()}!`;
    form.reset();
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
      callback: token => { rsvpTurnstileToken = token; },
      'expired-callback': () => { rsvpTurnstileToken = ''; },
      'error-callback': () => { rsvpTurnstileToken = ''; }
    });
  };
  const script = document.createElement('script');
  script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=onRsvpTurnstileLoad';
  script.async = true;
  script.defer = true;
  script.onerror = () => { status.textContent = 'Não foi possível carregar a verificação. Atualize a página para tentar novamente.'; };
  document.head.append(script);
}
loadRsvpTurnstile();

const floatingGiftsLink = document.querySelector('.floating-gifts-cta');
if (floatingGiftsLink && 'IntersectionObserver' in window) {
  const coveredSections = new Set();
  const floatingLinkObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) coveredSections.add(entry.target);
      else coveredSections.delete(entry.target);
    });
    floatingGiftsLink.classList.toggle('is-hidden', coveredSections.size > 0);
  }, { threshold: 0 });
  floatingLinkObserver.observe(document.querySelector('#rsvp'));
  floatingLinkObserver.observe(document.querySelector('.site-footer'));
}

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
    }).format(new Date(targetTime)) + ' · Aracati/CE (horário de Brasília)';
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

  function showSlide(index) {
    activeSlide = (index + slides.length) % slides.length;
    track.style.transform = `translateX(-${activeSlide * 100}%)`;
    position.textContent = String(activeSlide + 1).padStart(2, '0');
    slides.forEach((slide, slideIndex) => {
      slide.setAttribute('aria-hidden', String(slideIndex !== activeSlide));
    });
  }

  function stopAutoplay() {
    clearInterval(autoplay);
  }

  function startAutoplay() {
    stopAutoplay();
    if (!reducedMotion.matches && slides.length > 1) {
      autoplay = setInterval(() => showSlide(activeSlide + 1), 5000);
    }
  }

  previous.addEventListener('click', () => {
    showSlide(activeSlide - 1);
    startAutoplay();
  });
  next.addEventListener('click', () => {
    showSlide(activeSlide + 1);
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
  showSlide(0);
  startAutoplay();
}

