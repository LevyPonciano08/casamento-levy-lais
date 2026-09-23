const menuButton = document.querySelector('.menu-toggle');
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
matchMedia('(min-width: 601px)').addEventListener('change', closeMenu);
document.querySelectorAll('details').forEach(item => item.addEventListener('toggle', () => {
  if (item.open) document.querySelectorAll('details[open]').forEach(other => {
    if (other !== item) other.open = false;
  });
}));
const form = document.querySelector('.rsvp-form');
const status = document.querySelector('.form-status');
form.addEventListener('submit', event => {
  event.preventDefault();
  if (!form.checkValidity()) {
    status.textContent = 'Preencha seu nome e escolha uma opção de presença.';
    form.reportValidity();
    return;
  }
  const data = Object.fromEntries(new FormData(form));
  try {
    localStorage.setItem('rsvp-levy-lais', JSON.stringify(data));
    status.textContent = `Obrigada, ${data.nome}. Esta é uma confirmação de demonstração, salva apenas neste navegador.`;
    form.reset();
  } catch {
    status.textContent = 'Não foi possível salvar a demonstração neste navegador. Tente novamente com o armazenamento local habilitado.';
  }
});

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
    }).format(new Date(targetTime)) + ' · Aracati, Ceará';
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
        if (fields[key]) fields[key].textContent = String(value).padStart(2, '0');
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

