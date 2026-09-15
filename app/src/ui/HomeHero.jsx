import { useEffect, useRef, useState } from "react";
import "./HomeHero.css";

export default function HomeHero({ words = [], onStart }) {
  const cards = Array.isArray(words)
    ? words.filter((word) => typeof word === "string" && word.trim()).slice(0, 12)
    : [];

  const ringRef = useRef(null);
  const cardRefs = useRef([]);
  const timerRef = useRef(null);
  const busyRef = useRef(false);
  const [activeIndex, setActiveIndex] = useState(null);
  const [reducedMotion, setReducedMotion] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  const cardsKey = JSON.stringify(cards);
  const count = cards.length;
  const step = count ? 360 / count : 0;
  const radius =
    count <= 1 ? 0 : Math.max(100, 78 / Math.sin(Math.PI / count));

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    busyRef.current = false;
    setActiveIndex(null);

    return () => {
      window.clearTimeout(timerRef.current);
      busyRef.current = false;
    };
  }, [cardsKey]);

  function start() {
    if (!count || busyRef.current || typeof onStart !== "function") return;

    const ring = ringRef.current;
    if (!ring) return;

    busyRef.current = true;
    ring.style.animationPlayState = "paused";

    const transform = window.getComputedStyle(ring).transform;
    const matrix =
      transform === "none" ? new DOMMatrix() : new DOMMatrix(transform);
    const rotation = Math.atan2(matrix.m31, matrix.m11);
    let frontIndex = 0;
    let greatestDepth = -Infinity;

    cards.forEach((_, index) => {
      const depth = Math.cos(rotation + (index * step * Math.PI) / 180);
      if (depth > greatestDepth) {
        greatestDepth = depth;
        frontIndex = index;
      }
    });

    const card = cardRefs.current[frontIndex];
    if (!card) {
      busyRef.current = false;
      ring.style.animationPlayState = "";
      return;
    }

    const rect = card.getBoundingClientRect();
    const word = cards[frontIndex];
    const skipMotion =
      reducedMotion ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    setActiveIndex(frontIndex);

    if (skipMotion) {
      onStart(word, rect);
      return;
    }

    timerRef.current = window.setTimeout(() => {
      onStart(word, rect);
    }, 420);
  }

  return (
    <section
      className="home-hero"
      aria-label="Япон үгийн дасгал"
      style={{ "--hero-radius": `${radius}px` }}
    >
      <div className="home-hero__stage" aria-hidden="true">
        <div className="home-hero__perspective">
          <div
            key={cardsKey}
            ref={ringRef}
            className="home-hero__ring"
            style={{
              animationPlayState: activeIndex !== null ? "paused" : "running",
            }}
          >
            {cards.map((word, index) => (
              <div
                className="home-hero__slot"
                key={`${index}-${word}`}
                style={{
                  transform: `rotateY(${index * step}deg) translateZ(var(--hero-radius))`,
                }}
              >
                <div
                  ref={(element) => {
                    cardRefs.current[index] = element;
                  }}
                  className={`home-hero__card${
                    activeIndex === index ? " home-hero__card--leaving" : ""
                  }`}
                  lang="ja"
                >
                  {word}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <button
        type="button"
        className="home-hero__start"
        onClick={start}
        disabled={!count || activeIndex !== null || typeof onStart !== "function"}
        aria-busy={activeIndex !== null}
      >
        Эхлүүлэх
      </button>

      {!count && (
        <p className="home-hero__empty" role="status">
          Одоогоор үг алга.
        </p>
      )}
    </section>
  );
}
