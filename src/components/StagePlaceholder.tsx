/** Shared shell used by the not-yet-implemented stage screens. */
export default function StagePlaceholder({ title, hint }: { title: string; hint?: string }) {
  return (
    <section className="page page--stage">
      <h1 className="stage-title">{title}</h1>
      {hint ? <p className="stage-subtitle">{hint}</p> : null}
    </section>
  );
}
