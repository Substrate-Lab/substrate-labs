// Substrate — light editorial site behaviors (progressive enhancement only).
// The hero "growing tree" canvas was retired in the light redesign.
(() => {
  // Scroll-spy: highlight the nav link whose section is currently in view.
  const links = Array.from(document.querySelectorAll('.topbar nav a[href^="#"]'));
  const pairs = links
    .map((a) => [document.querySelector(a.getAttribute('href')), a])
    .filter(([el]) => el);
  if (!pairs.length || !('IntersectionObserver' in window)) return;

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        links.forEach((l) => l.classList.remove('active'));
        const found = pairs.find(([el]) => el === e.target);
        if (found) found[1].classList.add('active');
      });
    },
    // trigger when a section crosses the upper-middle of the viewport
    { rootMargin: '-46% 0px -50% 0px' }
  );
  pairs.forEach(([el]) => io.observe(el));
})();
