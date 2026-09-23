'use client';
import { createElement as h, useEffect, useMemo, useState } from 'react';
import { validate, decodeDot, frameAt, containerStyle, dotStyle } from './index.js';

/**
 * <DotLoader loader={definition} />
 * @param {import('./react').DotLoaderProps} props
 */
export function DotLoader({ loader: def, size, gap, label = 'Loading', className, style }) {
  const loader = useMemo(() => validate(def), [def]);
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    setFrame(0);
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const start = performance.now();
    let raf = 0;
    const tick = () => {
      setFrame(frameAt(loader, performance.now() - start));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [loader]);

  const s = size ?? loader.size;
  const g = gap ?? (s * loader.gap) / loader.size;
  const cells = loader.frames[frame % loader.frames.length];
  return h(
    'div',
    { role: 'status', 'aria-label': label, className, style: { ...containerStyle(loader, s, g), ...style } },
    Array.from(cells, (c, i) => h('span', { key: i, style: dotStyle(loader, i, decodeDot(c), s) })),
  );
}

export default DotLoader;
