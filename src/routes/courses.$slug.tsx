import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMeQuery, useTrip } from "@/lib/hooks";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/courses/$slug")({ component: CoursePage });

function CoursePage() {
  const { slug } = Route.useParams();
  const { data, isPending } = useTrip();
  const me = useMeQuery();
  const [teeId, setTeeId] = useState<number | null>(null);
  if (isPending || !data) return <div className="h-40 animate-pulse rounded-[18px] bg-navy-2" />;
  const course = data.courses.find((c) => c.slug === slug);
  if (!course) return <p>Unknown course.</p>;
  const tees = data.tees.filter((t) => t.course_id === course.id);
  const defaultTee = tees.find((t) => t.name === "Blue") ?? tees[0];
  const activeTee = tees.find((t) => t.id === teeId) ?? defaultTee;
  const holes = data.holes.filter((h) => h.tee_id === activeTee?.id).sort((a, b) => a.number - b.number);
  const round = data.rounds.find((r) => r.course_id === course.id);
  const map = `https://maps.google.com/?q=${encodeURIComponent(`${course.address}, ${course.city}`)}`;
  const front = holes.filter((h) => h.number <= 9);
  const back = holes.filter((h) => h.number >= 10);
  const sum = (rows: typeof holes, key: "par" | "yardage") => rows.reduce((s, h) => s + h[key], 0);
  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-[28px] border border-line">
        <img src={course.image_url ?? "/images/hero.jpg"} alt={course.name} className="h-56 w-full object-cover md:h-80" />
      </div>
      <header>
        <p className="text-[11px] uppercase tracking-[0.2em] text-gold">{course.theme}</p>
        <h1 className="font-display text-4xl">{course.name}</h1>
        <p className="text-sm text-muted">
          {course.designer} · {course.address}, {course.city}
        </p>
        <a href={map} className="text-sm text-gold" target="_blank" rel="noreferrer">
          Map
        </a>
      </header>
      <p className="text-sm leading-relaxed text-cream/80">{course.description}</p>
      {round ? (
        <p className="text-sm">
          Tee time {round.tee_time} · {round.date}
        </p>
      ) : null}
      {tees.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          {tees.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTeeId(t.id)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs uppercase tracking-[0.12em]",
                activeTee?.id === t.id ? "border-gold text-gold" : "border-line text-cream/80",
              )}
            >
              <span className="size-2.5 rounded-full" style={{ background: t.color }} />
              {t.name}
            </button>
          ))}
        </div>
      ) : null}
      {activeTee ? (
        <p className="text-sm text-muted">
          {activeTee.name} tees · {activeTee.yardage} yds · {Number(activeTee.rating).toFixed(1)} /{" "}
          {activeTee.slope} · Par {course.par}
        </p>
      ) : null}
      <div className="overflow-x-auto rounded-[18px] border border-line">
        <table className="w-full min-w-[640px] text-center text-sm">
          <thead className="bg-navy-2 text-xs uppercase tracking-[0.12em] text-gold">
            <tr>
              <th className="p-2">Hole</th>
              {holes.map((h) => (
                <th key={h.id} className="p-2 tabular">
                  {h.number}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="p-2 text-muted">Yds</td>
              {holes.map((h) => (
                <td key={h.id} className="p-2 tabular">
                  {h.yardage}
                </td>
              ))}
            </tr>
            <tr className="bg-navy-2/50">
              <td className="p-2 text-muted">Par</td>
              {holes.map((h) => (
                <td key={h.id} className="p-2 tabular">
                  {h.par}
                </td>
              ))}
            </tr>
            <tr>
              <td className="p-2 text-muted">SI</td>
              {holes.map((h) => (
                <td key={h.id} className="p-2 tabular">
                  {h.stroke_index}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      {holes.length === 18 ? (
        <p className="text-xs uppercase tracking-[0.14em] text-muted">
          Out {sum(front, "par")} / {sum(front, "yardage")} · In {sum(back, "par")} / {sum(back, "yardage")} ·
          Total {sum(holes, "par")} / {sum(holes, "yardage")}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-4">
        {me.data?.isAdmin ? (
          <Link to="/seth/courses" search={{ course: course.slug }} className="text-sm text-gold">
            Edit this scorecard
          </Link>
        ) : null}
        <Link to="/itinerary" className="text-sm text-gold">
          Back to itinerary
        </Link>
      </div>
    </div>
  );
}
