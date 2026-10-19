import { useEffect, useState, type RefObject } from 'react';

/** True once the scroll container has scrolled more than `offset` px (drives the FAB). */
export function useScrolledPast(ref: RefObject<HTMLElement | null>, offset = 120): boolean {
  const [past, setPast] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setPast(el.scrollTop > offset));
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener('scroll', update);
    };
  }, [ref, offset]);

  return past;
}
