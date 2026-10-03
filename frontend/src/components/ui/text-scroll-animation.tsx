import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { animate, motion, useMotionValue, useReducedMotion, useScroll, useTransform, type MotionValue } from 'motion/react';

interface TextScrollAnimationProps {
  text: string;
  className?: string;
  /** Exact phrases to color with the existing accent token. */
  emphasis?: readonly string[];
}
type ScrollContext = { element: HTMLElement | null; scrollable: boolean };

function scrollContext(target: HTMLElement): ScrollContext {
  for (let parent = target.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
    if (/(auto|scroll)/.test(getComputedStyle(parent).overflowY) && parent.scrollHeight > parent.clientHeight + 1) {
      return { element: parent, scrollable: true };
    }
  }
  const root = document.scrollingElement;
  return { element: null, scrollable: !!root && root.scrollHeight > root.clientHeight + 1 };
}

function Character({ char, index, count, progress, highlighted }: {
  char: string; index: number; count: number; progress: MotionValue<number>; highlighted: boolean;
}) {
  const distance = count > 1 ? (index - (count - 1) / 2) / ((count - 1) / 2) : 0;
  const x = useTransform(progress, [0, 1], [distance * 1.5, 0]);
  const rotateX = useTransform(progress, [0, 1], [distance * 4, 0]);
  return <motion.span className={`text-scroll-character${highlighted ? ' text-scroll-accent' : ''}`} style={{ x, rotateX }}>{char}</motion.span>;
}

function Characters({ text, emphasis, progress }: { text: string; emphasis: readonly string[]; progress: MotionValue<number> }) {
  const graphemes = Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text));
  const highlighted = (start: number) => emphasis.some(phrase => {
    if (!phrase) return false;
    for (let offset = text.indexOf(phrase); offset !== -1; offset = text.indexOf(phrase, offset + phrase.length)) {
      if (start >= offset && start < offset + phrase.length) return true;
    }
    return false;
  });
  // Word boundaries preserve natural English/Thai wrapping; graphemes preserve combining marks.
  const words = Array.from(new Intl.Segmenter(undefined, { granularity: 'word' }).segment(text));
  let index = 0;
  return <span aria-hidden="true" className="text-scroll-visual">{words.map(word => {
    const chars = graphemes.filter(g => g.index >= word.index && g.index < word.index + word.segment.length);
    const content = chars.map(g => <Character key={g.index} char={g.segment} index={index++} count={graphemes.length} progress={progress} highlighted={highlighted(g.index)} />);
    return /\s/u.test(word.segment) ? <span key={word.index}>{word.segment}</span> : <span className="text-scroll-word" key={word.index}>{content}</span>;
  })}</span>;
}

function EntranceText(props: { text: string; emphasis: readonly string[] }) {
  const progress = useMotionValue(0);
  useEffect(() => {
    const controls = animate(progress, 1, { duration: 0.42, ease: 'easeOut' });
    return () => controls.stop();
  }, [progress]);
  return <Characters {...props} progress={progress} />;
}

function ScrollText({ target, container, ...props }: {
  target: RefObject<HTMLParagraphElement | null>; container: HTMLElement | null; text: string; emphasis: readonly string[];
}) {
  const containerRef = useMemo(() => ({ current: container }), [container]);
  const { scrollYProgress } = useScroll({ target, ...(container ? { container: containerRef } : {}), offset: ['start end', 'end 0.85'] });
  return <Characters {...props} progress={scrollYProgress} />;
}

export function TextScrollAnimation({ text, className = '', emphasis = [] }: TextScrollAnimationProps) {
  const target = useRef<HTMLParagraphElement>(null);
  const reduced = useReducedMotion();
  const complete = useMotionValue(1);
  const [context, setContext] = useState<ScrollContext | null>(null);
  useEffect(() => {
    if (!target.current) return;
    let disposed = false;
    const measure = () => {
      // A queued resize can arrive after the auth screen has unmounted.
      const element = target.current;
      if (disposed || !element?.isConnected) return;
      const next = scrollContext(element);
      setContext(previous => previous?.element === next.element && previous.scrollable === next.scrollable ? previous : next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(document.documentElement);
    observer.observe(document.body);
    for (let parent = target.current.parentElement; parent; parent = parent.parentElement) observer.observe(parent);
    window.addEventListener('resize', measure);
    return () => { disposed = true; observer.disconnect(); window.removeEventListener('resize', measure); };
  }, []);
  const staticText = reduced || typeof Intl.Segmenter !== 'function' || !context;
  return <p ref={target} className={`text-scroll-animation ${className}`} data-animation={staticText ? 'static' : context.scrollable ? 'scroll' : 'entrance'}>
    {typeof Intl.Segmenter !== 'function' ? text : <><span className="sr-only">{text}</span>{staticText ? <Characters text={text} emphasis={emphasis} progress={complete} /> : context.scrollable
      ? <ScrollText key={context.element ? 'element' : 'document'} target={target} container={context.element} text={text} emphasis={emphasis} />
      : <EntranceText text={text} emphasis={emphasis} />}</>}
  </p>;
}
