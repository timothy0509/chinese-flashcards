import { useRef, type ReactNode } from "react";
import type { Card } from "../lib/srs";

function renderSentence(sentence: string, term: string) {
  if (!term) return <span>{sentence}</span>;
  const parts: ReactNode[] = [];
  let rest = sentence;
  let key = 0;
  for (;;) {
    const i = rest.indexOf(term);
    if (i === -1) {
      parts.push(<span key={key++}>{rest}</span>);
      break;
    }
    if (i > 0) parts.push(<span key={key++}>{rest.slice(0, i)}</span>);
    parts.push(<mark key={key++}>{term}</mark>);
    rest = rest.slice(i + term.length);
  }
  return <span>{parts}</span>;
}

const MAX_TILT = 6;

export default function Flashcard({
  card,
  flipped,
  onFlip,
  cardKey,
  enterDir,
  flash,
}: {
  card: Card;
  flipped: boolean;
  onFlip: () => void;
  cardKey: string;
  enterDir: 1 | -1;
  flash: "good" | "bad" | null;
}) {
  const rootRef = useRef<HTMLDivElement>(null);

  function onPointerMove(e: React.PointerEvent) {
    if (e.pointerType !== "mouse") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = rootRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty("--ry", `${(px * MAX_TILT * 2).toFixed(2)}deg`);
    el.style.setProperty("--rx", `${(-py * MAX_TILT * 2).toFixed(2)}deg`);
  }

  function onPointerLeave() {
    const el = rootRef.current;
    if (!el) return;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
  }

  return (
    <div
      ref={rootRef}
      className="flip"
      onClick={onFlip}
      role="button"
      tabIndex={0}
      aria-label={flipped ? "切回題目" : "翻面看答案"}
      data-flash={flash ?? undefined}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onFlip();
        }
      }}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
    >
      <div className="flip-tilt">
        <div
          key={cardKey}
          className={`flip-inner${flipped ? " is-flipped" : ""}`}
          data-dir={enterDir}
        >
          <div className="flip-face flip-front card" aria-hidden={flipped}>
            <div className="card-chapter">{card.chapter}</div>
            <p className="sentence">
              {renderSentence(card.sentence, card.term)}
            </p>
          </div>
          <div
            className="flip-face flip-back card"
            aria-hidden={!flipped}
            aria-live="polite"
          >
            <div className="card-chapter">{card.chapter}</div>
            <p className="term">{card.term}</p>
            <p className="answer">{card.answer}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

