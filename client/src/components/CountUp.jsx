import { useEffect, useRef, useState } from 'react';

// Number that counts up from 0 the first time it scrolls into view.
// Screen readers get the real number straight away; people who prefer
// reduced motion see it without the animation.
export default function CountUp({ value }) {
  const ref = useRef(null);
  const [instant] = useState(
    () => Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) || typeof IntersectionObserver === 'undefined',
  );
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el || instant) return undefined;
    let frame;
    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      io.disconnect();
      const start = performance.now();
      const tick = (now) => {
        const t = Math.min(1, (now - start) / 1200);
        setShown(Math.round(value * (1 - (1 - t) ** 3)));
        if (t < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    });
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value, instant]);
  return (
    <span ref={ref}>
      <span aria-hidden="true">{instant ? value : shown}</span>
      <span className="visually-hidden">{value}</span>
    </span>
  );
}

