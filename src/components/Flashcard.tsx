import type { Card } from "../lib/srs";

function renderSentence(sentence: string, term: string) {
  const i = sentence.indexOf(term);
  if (i === -1) return <span>{sentence}</span>;
  return (
    <span>
      {sentence.slice(0, i)}
      <mark>{term}</mark>
      {sentence.slice(i + term.length)}
    </span>
  );
}

export default function Flashcard({
  card,
  flipped,
  onFlip,
}: {
  card: Card;
  flipped: boolean;
  onFlip: () => void;
}) {
  return (
    <button
      type="button"
      className={`card${flipped ? " flipped" : ""}`}
      onClick={onFlip}
      aria-label={flipped ? "切回題目" : "翻面看答案"}
    >
      <div className="card-chapter">{card.chapter}</div>
      {!flipped ? (
        <div className="card-front">
          <p className="sentence">{renderSentence(card.sentence, card.term)}</p>
          <p className="hint">點一下或按空白鍵看答案</p>
        </div>
      ) : (
        <div className="card-back">
          <p className="term">{card.term}</p>
          <p className="answer">{card.answer}</p>
          <p className="sentence-small">{card.sentence}</p>
        </div>
      )}
    </button>
  );
}
