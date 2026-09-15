import { useEffect, useRef, useState } from "react";
import "./ProgressRing.css";

const DURATION = 420;
const RADIUS = 44;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function ProgressRing({ done, total, size = 120, label }) {
  const target = total > 0 ? done : 0;
  const progress = total > 0 ? Math.min(1, Math.max(0, done / total)) : 0;
  const complete = total > 0 && done >= total;

  const [count, setCount] = useState(0);
  const currentCount = useRef(0);
  const [reducedMotion, setReducedMotion] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false
  );

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (
      reducedMotion ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      total <= 0
    ) {
      currentCount.current = target;
      setCount(target);
      return;
    }

    const from = currentCount.current;
    let frame;
    let start;

    const tick = (timestamp) => {
      start ??= timestamp;
      const elapsed = Math.min((timestamp - start) / DURATION, 1);
      const eased = 1 - Math.pow(1 - elapsed, 3);
      const next = elapsed === 1 ? target : from + (target - from) * eased;

      currentCount.current = next;
      setCount(elapsed === 1 ? target : Math.round(next));

      if (elapsed < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, total, reducedMotion]);

  return (
    <div
      className="progress-ring"
      style={{ width: size, height: size, "--ring-size": `${size}px` }}
      role="img"
      aria-label={`${label ? `${label}: ` : ""}${target} / ${total > 0 ? total : 0}`}
    >
      <svg
        className="progress-ring__svg"
        viewBox="0 0 100 100"
        aria-hidden="true"
      >
        <circle className="progress-ring__track" cx="50" cy="50" r={RADIUS} />
        <circle
          className={`progress-ring__arc${complete ? " progress-ring__arc--complete" : ""}`}
          cx="50"
          cy="50"
          r={RADIUS}
          strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
          strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
          opacity={progress > 0 ? 1 : 0}
        />
      </svg>

      <div className="progress-ring__center" aria-hidden="true">
        <span className="progress-ring__count">
          {total <= 0 ? 0 : reducedMotion ? target : count}
        </span>
        {label != null && (
          <span className="progress-ring__label">{label}</span>
        )}
      </div>
    </div>
  );
}
