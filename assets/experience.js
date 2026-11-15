// Progressive motion: content remains visible if animation or JavaScript is unavailable.
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
const activeAnimations = new Set();
function animate(element, frames, options = {}) {
  if (motionPreference.matches || !element?.animate) return;
  const animation = element.animate(frames, {
    duration: 800, easing: 'cubic-bezier(.16,1,.3,1)', ...options
  });
  activeAnimations.add(animation);
  animation.finished.catch(() => {}).finally(() => activeAnimations.delete(animation));
}

// Headings settle in place; photographs open horizontally, rather than repeating
// one slide effect on every section. No element starts hidden in CSS.
const revealObserver = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    revealObserver.unobserve(entry.target);
    if (entry.target.matches('.story-carousel,.location-map')) {
      animate(entry.target, [
        {clipPath:'inset(0 5% 0 5% round 16px)',opacity:.8},
        {clipPath:'inset(0 0% 0 0% round 16px)',opacity:1}
      ], {duration:1100});
    } else if (entry.target.matches('.gift-card')) {
      animate(entry.target, [{opacity:.65,transform:'translateY(14px)'},{opacity:1,transform:'none'}], {duration:550});
    } else {
      animate(entry.target, [{opacity:.65,transform:'translateY(16px)'},{opacity:1,transform:'none'}]);
    }
  }
}, {threshold:.12}) : null;

document.querySelectorAll('.welcome h2,.story-carousel,.details-heading,.rsvp-intro,.location-map,.gift-copy,.faq-title,.closing h2,.gift-card').forEach(element => revealObserver?.observe(element));
const grid = document.querySelector('.gift-grid');
if (grid && revealObserver) {
  new MutationObserver(records => {
    for (const record of records) for (const node of record.addedNodes) {
      if (node.nodeType === 1 && node.matches('.gift-card')) revealObserver.observe(node);
    }
  }).observe(grid, {childList:true});
}

const hero = document.querySelector('.hero');
const heroPhoto = hero?.querySelector('img');
let photoFrame = 0;
let heroVisible = true;
function updatePhoto() {
  photoFrame = 0;
  if (!heroPhoto || motionPreference.matches) return;
  // A small, bounded movement keeps the couple in frame on narrow screens.
  const offset = Math.min(Math.max(scrollY, 0), hero.offsetHeight) * .065;
  heroPhoto.style.transform = `translateY(${offset}px) scale(1.06)`;
}
if (heroPhoto) {
  if ('IntersectionObserver' in window) new IntersectionObserver(entries => {
    heroVisible = entries[0].isIntersecting;
  }).observe(hero);
  window.addEventListener('scroll', () => {
    if (heroVisible && !motionPreference.matches && !photoFrame) photoFrame = requestAnimationFrame(updatePhoto);
  }, {passive:true});
  updatePhoto();
}
motionPreference.addEventListener('change', () => {
  if (motionPreference.matches) {
    for (const animation of activeAnimations) animation.cancel();
    if (heroPhoto) heroPhoto.style.transform = '';
  } else updatePhoto();
});
