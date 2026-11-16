import { useEffect } from 'react';

// Page-wide scroll effects, mounted once in App:
//  - anything marked data-reveal="up|pop|left|right|zoom" slides or pops into
//    view the first time it scrolls into sight (data-reveal-delay staggers it)
//  - the header gets "is-scrolled" (smaller, with a shadow) once the page moves
//
// Accessible by design: nothing is hidden until this code runs (the "js-reveal"
// class turns the effect on), and people who ask for reduced motion, or
// browsers without IntersectionObserver, see everything straight away.
const reducedMotion = () => Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

export default function ScrollEffects() {
  useEffect(() => {
    const root = document.documentElement;
    const header = document.querySelector('.site-header');
    const setHeaderOffset = () => {
      const top = [...(header?.children || [])]
        .filter((el) => !el.classList.contains('main-bar'))
        .reduce((sum, el) => sum + el.offsetHeight, 0);
      root.style.setProperty('--header-offset', `${-top}px`);
    };
    const onScroll = () => {
      header?.classList.toggle('is-scrolled', window.scrollY > 60);
    };
    setHeaderOffset();
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', setHeaderOffset);

    if (reducedMotion() || typeof IntersectionObserver === 'undefined') {
      return () => {
        window.removeEventListener('scroll', onScroll);
        window.removeEventListener('resize', setHeaderOffset);
      };
    }

    root.classList.add('js-reveal');
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            io.unobserve(entry.target);
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
    );
    const watch = () => {
      setHeaderOffset();
      document.querySelectorAll('[data-reveal]:not(.is-visible):not([data-watched])').forEach((el) => {
        el.setAttribute('data-watched', '');
        const delay = el.getAttribute('data-reveal-delay');
        if (delay) el.style.setProperty('--reveal-delay', `${delay}ms`);
        io.observe(el);
      });
    };
    watch();
    // New pages and newly loaded cards get the effect too.
    const mo = new MutationObserver(watch);
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      mo.disconnect();
      io.disconnect();
      root.classList.remove('js-reveal');
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', setHeaderOffset);
    };
  }, []);

  return null;
}
