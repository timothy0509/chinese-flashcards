import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from "motion/react";
import type { ReactNode } from "react";
import type { Card } from "../lib/srs";
import { cn } from "../lib/cn";

function renderBlanked(sentence: string, term: string, occurrence?: number) {
  if (!term || !sentence.includes(term)) return <span>{sentence}</span>;
  const chunks = sentence.split(term);
  const parts: ReactNode[] = [];
  let key = 0;
  chunks.forEach((chunk, i) => {
    parts.push(<span key={key++}>{chunk}</span>);
    if (i < chunks.length - 1) {
      const isTarget = occurrence === undefined || occurrence === i;
      parts.push(
        isTarget ? (
          <span
            key={key++}
            aria-hidden="true"
            className="mx-1 inline-block min-w-[2.2em] border-b-2 border-accent text-center font-black text-accent"
          >
            ？
          </span>
        ) : (
          <span key={key++}>{term}</span>
        ),
      );
    }
  });
  return <span>{parts}</span>;
}

function renderSentence(
  sentence: string,
  term: string,
  occurrence?: number,
) {
  if (!term) return <span>{sentence}</span>;
  const parts: ReactNode[] = [];
  let rest = sentence;
  let key = 0;
  let seen = 0;
  for (;;) {
    const i = rest.indexOf(term);
    if (i === -1) {
      parts.push(<span key={key++}>{rest}</span>);
      break;
    }
    if (i > 0) parts.push(<span key={key++}>{rest.slice(0, i)}</span>);
    if (occurrence === undefined || seen === occurrence) {
      parts.push(
        <mark key={key++} className="sentence-mark">
          {term}
        </mark>,
      );
    } else {
      parts.push(<span key={key++}>{term}</span>);
    }
    seen += 1;
    rest = rest.slice(i + term.length);
  }
  return <span>{parts}</span>;
}

const FLIP_TRANSITION = { duration: 0.5, ease: [0.2, 0.7, 0.3, 1.05] as const };
const MAX_TILT = 12;

const face =
  "relative col-start-1 row-start-1 flex min-h-[380px] w-full flex-col " +
  "items-center justify-center gap-4 rounded-panel border border-line-strong " +
  "bg-card px-6 py-7 text-center shadow-soft backface-hidden " +
  "max-sm:min-h-[320px] sm:px-10 " +
  "after:pointer-events-none after:absolute after:inset-2 " +
  "after:rounded-xl after:border after:border-line";

const chip =
  "inline-flex rounded-full border border-accent/25 bg-accent/10 px-3.5 py-1 " +
  "font-serif text-[0.85rem] tracking-[0.06em] text-accent-deep";

export default function Flashcard({
  card,
  flipped,
  onFlip,
  cardKey,
  enterDir,
  flash,
  direction,
}: {
  card: Card;
  flipped: boolean;
  onFlip: () => void;
  cardKey: string;
  enterDir: 1 | -1;
  flash: "good" | "bad" | null;
  direction: "forward" | "reverse";
}) {
  const reduce = useReducedMotion();
  const tiltX = useMotionValue(0);
  const tiltY = useMotionValue(0);
  const springX = useSpring(tiltX, { stiffness: 180, damping: 22 });
  const springY = useSpring(tiltY, { stiffness: 180, damping: 22 });

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== "mouse" || reduce) return;
    const r = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    tiltY.set(px * MAX_TILT);
    tiltX.set(-py * MAX_TILT);
  }

  function onPointerLeave() {
    tiltX.set(0);
    tiltY.set(0);
  }

  const flashRing =
    flash === "good"
      ? "ring-[3px] ring-success/50 border-success"
      : flash === "bad"
        ? "ring-[3px] ring-accent/40 border-accent"
        : "";

  return (
    <div
      className={cn(
        "cursor-pointer rounded-panel [perspective:1400px] select-none",
        flashRing,
      )}
      onClick={onFlip}
      role="button"
      tabIndex={0}
      aria-label={flipped ? "切回題目" : "翻面看答案"}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onFlip();
        }
      }}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
    >
      <motion.div
        style={{ rotateX: springX, rotateY: springY }}
        className="grid [transform-style:preserve-3d]"
      >
        {/* keyed remount replays the deal-in on every card change */}
        <motion.div
          key={cardKey}
          initial={{ opacity: 0, x: reduce ? 0 : enterDir * 32 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="grid [transform-style:preserve-3d]"
        >
          <motion.div
            animate={{ rotateY: flipped ? 180 : 0 }}
            transition={reduce ? { duration: 0 } : FLIP_TRANSITION}
            className="grid [transform-style:preserve-3d]"
          >
            <div className={face} aria-hidden={flipped}>
              <div className={chip}>{card.chapter}</div>
              {direction === "forward" ? (
                <>
                  <p className="m-0 font-sans text-[0.78rem] tracking-[0.2em] text-muted">
                    這個字在句中是什麼意思？
                  </p>
                  <p className="m-0 max-w-[21em] font-serif text-[clamp(1.5rem,4.2vw,2.05rem)] font-semibold leading-[1.9] [text-wrap:balance]">
                    {renderSentence(card.sentence, card.term, card.occurrence)}
                  </p>
                </>
              ) : (
                <>
                  <p className="m-0 font-sans text-[0.78rem] tracking-[0.2em] text-muted">
                    哪個字是這個意思？
                  </p>
                  <p className="m-0 font-serif text-[clamp(2rem,7vw,2.8rem)] font-black tracking-[0.04em] text-accent">
                    {card.answer}
                  </p>
                  <p className="m-0 max-w-[21em] font-serif text-[clamp(1.2rem,3.8vw,1.6rem)] leading-[1.9] [text-wrap:balance]">
                    {renderBlanked(card.sentence, card.term, card.occurrence)}
                  </p>
                </>
              )}
              <span className="absolute inset-x-0 bottom-4 indent-[0.3em] text-center font-sans text-[0.72rem] tracking-[0.3em] text-faint">
                心中答完再點按翻面
              </span>
            </div>
            <div
              className={cn(face, "rotate-y-180")}
              aria-hidden={!flipped}
              aria-live="polite"
            >
              <div className={chip}>{card.chapter}</div>
              <p className="m-0 max-w-[22em] font-serif text-[clamp(1rem,3.4vw,1.2rem)] leading-[1.9] text-muted [text-wrap:balance]">
                {renderSentence(card.sentence, card.term, card.occurrence)}
              </p>
              <p className="m-0 font-serif text-[clamp(2.4rem,8vw,3.2rem)] font-black tracking-[0.06em] text-accent">
                {card.term}
              </p>
              <p className="m-0 max-w-[24em] font-serif text-[clamp(1.15rem,3.8vw,1.4rem)] leading-[1.9]">
                {card.answer}
              </p>
            </div>
          </motion.div>
        </motion.div>
      </motion.div>
    </div>
  );
}
