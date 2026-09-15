import { useEffect, useRef, useState } from "react";
import "./StudyCard.css";

export default function StudyCard({ front, back, onGrade }) {
  const [revealed, setRevealed] = useState(false);
  const [drag, setDrag] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [exit, setExit] = useState(0);
  const [reduced, setReduced] = useState(false);

  const rootRef = useRef(null);
  const pointerRef = useRef(null);
  const revealedRef = useRef(false);
  const gradedRef = useRef(false);
  const timerRef = useRef(null);
  const onGradeRef = useRef(onGrade);
  onGradeRef.current = onGrade;

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    clearTimeout(timerRef.current);
    pointerRef.current = null;
    revealedRef.current = false;
    gradedRef.current = false;
    setRevealed(false);
    setDrag(0);
    setDragging(false);
    setExit(0);
    return () => clearTimeout(timerRef.current);
  }, [front, back]);

  function reveal() {
    if (gradedRef.current) return;
    revealedRef.current = true;
    setRevealed(true);
  }

  function grade(ok) {
    if (!revealedRef.current || gradedRef.current) return;
    gradedRef.current = true;
    pointerRef.current = null;
    setDragging(false);

    if (reduced) {
      setExit(ok ? 1 : -1);
      onGradeRef.current(ok);
      return;
    }

    const direction = ok ? 1 : -1;
    setDrag(direction * (window.innerWidth + 600));
    setExit(direction);

    const token = getComputedStyle(rootRef.current)
      .getPropertyValue("--dur-slow")
      .trim();
    const duration = parseFloat(token);
    const milliseconds = Number.isFinite(duration)
      ? duration * (token.endsWith("ms") ? 1 : 1000)
      : 420;

    timerRef.current = setTimeout(
      () => onGradeRef.current(ok),
      milliseconds
    );
  }

  function handleKeyDown(event) {
    if (event.altKey || event.ctrlKey || event.metaKey || event.repeat) return;
    if (event.target.closest("input, textarea, select, [contenteditable]")) return;

    if (event.code === "Space" && !revealedRef.current) {
      event.preventDefault();
      reveal();
    } else if (revealedRef.current && event.key === "ArrowLeft") {
      event.preventDefault();
      grade(false);
    } else if (revealedRef.current && event.key === "ArrowRight") {
      event.preventDefault();
      grade(true);
    }
  }

  function handlePointerDown(event) {
    if (
      !revealedRef.current ||
      gradedRef.current ||
      !event.isPrimary ||
      event.button !== 0 ||
      pointerRef.current
    ) return;

    rootRef.current.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerRef.current = {
      id: event.pointerId,
      startX: event.clientX,
    };
    setDragging(true);
  }

  function handlePointerMove(event) {
    const pointer = pointerRef.current;
    if (!pointer || pointer.id !== event.pointerId) return;
    setDrag(event.clientX - pointer.startX);
  }

  function finishPointer(event, cancelled = false) {
    const pointer = pointerRef.current;
    if (!pointer || pointer.id !== event.pointerId) return;

    const distance = event.clientX - pointer.startX;
    const threshold = Math.min(100, event.currentTarget.clientWidth * 0.25);
    pointerRef.current = null;
    setDragging(false);

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (!cancelled && Math.abs(distance) >= threshold) {
      grade(distance > 0);
    } else {
      setDrag(0);
    }
  }

  const tint = Math.min(Math.abs(drag) / 140, 0.65);

  return (
    <section
      ref={rootRef}
      className="study-card"
      tabIndex={0}
      aria-label="Суралцах карт"
      onKeyDown={handleKeyDown}
    >
      <div className="study-card__viewport">
        <div
          className={[
            "study-card__motion",
            dragging && "is-dragging",
            exit && "is-exiting",
          ].filter(Boolean).join(" ")}
          style={{
            "--drag-x": `${drag}px`,
            "--drag-angle": `${Math.max(-16, Math.min(16, drag / 18))}deg`,
            "--wrong-opacity": drag < 0 ? tint : 0,
            "--correct-opacity": drag > 0 ? tint : 0,
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishPointer}
          onPointerCancel={(event) => finishPointer(event, true)}
          onLostPointerCapture={(event) => finishPointer(event, true)}
        >
          <div className={`study-card__flip ${revealed ? "is-revealed" : ""}`}>
            <div
              className="study-card__face study-card__front"
              aria-hidden={revealed}
            >
              <span className="study-card__text" lang="ja">{front}</span>
            </div>
            <div
              className="study-card__face study-card__back"
              aria-hidden={!revealed}
            >
              <span className="study-card__text">{back}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="study-card__controls">
        {!revealed ? (
          <button type="button" onClick={reveal}>Харах</button>
        ) : (
          <>
            <button
              type="button"
              className="study-card__wrong"
              aria-label="Буруу"
              disabled={Boolean(exit)}
              onClick={() => grade(false)}
            >
              ✗
            </button>
            <button
              type="button"
              className="study-card__correct"
              aria-label="Зөв"
              disabled={Boolean(exit)}
              onClick={() => grade(true)}
            >
              ✓
            </button>
          </>
        )}
      </div>
    </section>
  );
}
