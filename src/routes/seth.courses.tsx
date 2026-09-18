import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { addCourseTee, assignRoundCourse, saveCourseScorecard } from "@/lib/server/api";
import { useMeQuery, useTrip } from "@/lib/hooks";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import {
  blankScorecard,
  duplicateStrokeIndexes,
  scorecardTotals,
  validateScorecard,
  type ScorecardHole,
} from "@/lib/golf/scorecard";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/seth/courses")({
  validateSearch: (search: Record<string, unknown>): { course?: string } => {
    if (typeof search.course === "string" && search.course.length) {
      return { course: search.course };
    }
    return {};
  },
  component: SethCourses,
});

const TEE_PRESETS = [
  { name: "Black", color: "#111111" },
  { name: "Blue", color: "#1e4b8c" },
  { name: "White", color: "#d9d4c8" },
  { name: "Gold", color: "#c4a35a" },
  { name: "Red", color: "#8b2e2e" },
];

const COURSE_PHOTOS = [
  { src: "/images/waldorf.jpg", label: "Waldorf" },
  { src: "/images/providence.jpg", label: "Providence" },
  { src: "/images/palm.jpg", label: "Palm" },
  { src: "/images/magnolia.jpg", label: "Magnolia" },
  { src: "/images/dunes.jpg", label: "Dunes" },
  { src: "/images/hero.jpg", label: "Clubhouse" },
];

function parseIntField(value: string): number {
  const raw = value.replace(/\D/g, "");
  return raw === "" ? 0 : Number(raw);
}

function SethCourses() {
  const { course: courseSlug } = Route.useSearch();
  const { user, isPending } = useCurrentUserState();
  const me = useMeQuery();
  const trip = useTrip();
  const qc = useQueryClient();
  const [courseId, setCourseId] = useState<number | "new" | null>(null);
  const [teeId, setTeeId] = useState<number | "new" | null>(null);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [designer, setDesigner] = useState("");
  const [theme, setTheme] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("/images/hero.jpg");
  const [teeName, setTeeName] = useState("Blue");
  const [teeColor, setTeeColor] = useState("#1e4b8c");
  const [rating, setRating] = useState("72.0");
  const [slope, setSlope] = useState("130");
  const [holes, setHoles] = useState<ScorecardHole[]>(blankScorecard);
  const [copyPar, setCopyPar] = useState(true);
  const [roundId, setRoundId] = useState("");
  const [dirty, setDirty] = useState(false);

  const loadedKey = useRef("");
  const data = trip.data;
  const course = data?.courses.find((c) => c.id === courseId) ?? null;
  const tees = data?.tees.filter((t) => t.course_id === course?.id) ?? [];

  useEffect(() => {
    if (!data || courseId !== null) return;
    if (!courseSlug) return;
    const match = data.courses.find((c) => c.slug === courseSlug);
    if (match) setCourseId(match.id);
  }, [data, courseSlug, courseId]);

  useEffect(() => {
    if (!data) return;
    if (courseId === "new") {
      if (loadedKey.current === "new") return;
      loadedKey.current = "new";
      setName("");
      setAddress("");
      setCity("Orlando, FL");
      setDesigner("");
      setTheme("");
      setDescription("");
      setImageUrl("/images/hero.jpg");
      setTeeId("new");
      setTeeName("Blue");
      setTeeColor("#1e4b8c");
      setRating("72.0");
      setSlope("130");
      setHoles(blankScorecard());
      setDirty(false);
      return;
    }
    if (typeof courseId !== "number") return;
    const selected = data.courses.find((c) => c.id === courseId);
    if (!selected) return;
    const courseTees = data.tees.filter((t) => t.course_id === selected.id);
    const nextTee = courseTees.find((t) => t.id === teeId) ?? courseTees.find((t) => t.name === "Blue") ?? courseTees[0];
    const key = `${courseId}:${nextTee?.id ?? "none"}`;
    if (loadedKey.current === key) return;
    loadedKey.current = key;
    setName(selected.name);
    setAddress(selected.address);
    setCity(selected.city);
    setDesigner(selected.designer ?? "");
    setTheme(selected.theme ?? "");
    setDescription(selected.description);
    setImageUrl(selected.image_url ?? "/images/hero.jpg");
    if (!nextTee) {
      setTeeId("new");
      setHoles(blankScorecard());
      setDirty(false);
      return;
    }
    setTeeId(nextTee.id);
    setTeeName(nextTee.name);
    setTeeColor(nextTee.color);
    setRating(nextTee.rating.toFixed(1));
    setSlope(String(nextTee.slope));
    const card = data.holes
      .filter((h) => h.tee_id === nextTee.id)
      .sort((a, b) => a.number - b.number)
      .map((h) => ({
        number: h.number,
        par: h.par,
        yardage: h.yardage,
        strokeIndex: h.stroke_index,
      }));
    setHoles(card.length === 18 ? card : blankScorecard());
    setDirty(false);
  }, [courseId, teeId, data]);

  const totals = useMemo(() => scorecardTotals(holes), [holes]);
  const problem = validateScorecard(holes);
  const dupSi = useMemo(() => duplicateStrokeIndexes(holes), [holes]);

  const save = useMutation({
    mutationFn: () =>
      saveCourseScorecard({
        data: {
          courseId: typeof courseId === "number" ? courseId : undefined,
          name,
          address,
          city,
          designer: designer || undefined,
          theme: theme || undefined,
          description,
          imageUrl,
          copyParAndIndex: copyPar,
          tee: {
            id: typeof teeId === "number" ? teeId : undefined,
            name: teeName,
            color: teeColor,
            rating: Number(rating),
            slope: Number(slope),
          },
          holes,
        },
      }),
    onSuccess: async (res) => {
      loadedKey.current = `${res.courseId}:${res.teeId}`;
      await qc.invalidateQueries({ queryKey: ["trip"] });
      setCourseId(res.courseId);
      setTeeId(res.teeId);
      setDirty(false);
      toast(`Scorecard saved. Par ${res.par} · ${res.yardage} yards.`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addTee = useMutation({
    mutationFn: (preset: (typeof TEE_PRESETS)[number]) =>
      addCourseTee({
        data: {
          courseId: course!.id,
          name: preset.name,
          color: preset.color,
          rating: Number(rating),
          slope: Number(slope),
          copyFromTeeId: typeof teeId === "number" ? teeId : undefined,
        },
      }),
    onSuccess: async (res) => {
      await qc.invalidateQueries({ queryKey: ["trip"] });
      loadedKey.current = "";
      setTeeId(res.teeId);
      toast("Tee set added. Yardages copied — change them if this tee plays shorter.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const assign = useMutation({
    mutationFn: () =>
      assignRoundCourse({
        data: {
          roundId: Number(roundId),
          courseId: course!.id,
          teeId: typeof teeId === "number" ? teeId : tees[0].id,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trip"] });
      toast("Round now uses this scorecard. Handicaps will follow the new rating and slope.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function patchHole(n: number, patch: Partial<ScorecardHole>) {
    setHoles((prev) => prev.map((h) => (h.number === n ? { ...h, ...patch } : h)));
    setDirty(true);
  }

  function leave(next: () => void) {
    if (dirty && !window.confirm("Leave unsaved holes?")) return;
    next();
  }

  if (isPending) return <div className="h-40 animate-pulse rounded-[18px] bg-navy-2" />;
  if (!user) return <RedirectToSignIn />;
  if (me.isFetched && !me.data?.isAdmin) return <p className="text-sm text-muted">Commissioner only.</p>;
  if (!data) return <div className="h-40 animate-pulse rounded-[18px] bg-navy-2" />;

  return (
    <div className="space-y-5">
      <header>
        <p className="text-[11px] uppercase tracking-[0.22em] text-gold">Seth Mode</p>
        <h1 className="font-display text-4xl">Scorecards</h1>
        <p className="mt-1 max-w-xl text-sm text-muted">
          One card per tee. Eighteen holes of par, yardage, and stroke index. Live scoring and USGA
          net handicaps read whatever you save here — not a screenshot in the group chat.
        </p>
      </header>

      <div className="grid gap-2 sm:grid-cols-2">
        {data.courses.map((c) => {
          const courseTees = data.tees.filter((t) => t.course_id === c.id);
          const shown = courseTees.find((t) => t.name === "Blue") ?? courseTees[0];
          return (
            <button
              key={c.id}
              type="button"
              onClick={() =>
                leave(() => {
                  setCourseId(c.id);
                  setTeeId(null);
                  loadedKey.current = "";
                })
              }
              className={cn(
                "rounded-[18px] border px-4 py-3 text-left",
                courseId === c.id ? "border-gold bg-gold/10" : "border-line bg-navy-2",
              )}
            >
              <p className="font-display text-xl text-cream">{c.name}</p>
              <p className="text-xs text-muted">
                Par {c.par}
                {shown ? ` · ${shown.yardage} yds · ${shown.name}` : " · no tees yet"}
                {courseTees.length > 1 ? ` · ${courseTees.length} tees` : ""}
              </p>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() =>
            leave(() => {
              setCourseId("new");
              loadedKey.current = "";
            })
          }
          className={cn(
            "rounded-[18px] border border-dashed px-4 py-3 text-left",
            courseId === "new" ? "border-gold bg-gold/10" : "border-gold/40",
          )}
        >
          <p className="font-display text-xl text-gold">New course</p>
          <p className="text-xs text-muted">Blank 18. Type the card from the rack.</p>
        </button>
      </div>

      {!courseId ? (
        <div className="panel p-5">
          <p className="font-display text-2xl">Pick a course</p>
          <p className="text-sm text-muted">
            Edit Waldorf, Providence, Palm, Magnolia, or Dunes — or start a sixth card if Seth found
            somewhere else to play.
          </p>
        </div>
      ) : (
        <>
          <section className="panel space-y-3 p-4">
            <h2 className="font-display text-2xl">Course</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label>Name</Label>
                <Input
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setDirty(true);
                  }}
                />
              </div>
              <div>
                <Label>City</Label>
                <Input
                  value={city}
                  onChange={(e) => {
                    setCity(e.target.value);
                    setDirty(true);
                  }}
                />
              </div>
              <div>
                <Label>Address</Label>
                <Input
                  value={address}
                  onChange={(e) => {
                    setAddress(e.target.value);
                    setDirty(true);
                  }}
                />
              </div>
              <div>
                <Label>Designer</Label>
                <Input
                  value={designer}
                  onChange={(e) => {
                    setDesigner(e.target.value);
                    setDirty(true);
                  }}
                />
              </div>
              <div>
                <Label>Theme line</Label>
                <Input
                  value={theme}
                  onChange={(e) => {
                    setTheme(e.target.value);
                    setDirty(true);
                  }}
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Notes on the card</Label>
                <Textarea
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value);
                    setDirty(true);
                  }}
                />
              </div>
            </div>
            <div>
              <Label>Photo</Label>
              <div className="mt-1 flex gap-2 overflow-x-auto pb-1">
                {COURSE_PHOTOS.map((photo) => (
                  <button
                    key={photo.src}
                    type="button"
                    onClick={() => {
                      setImageUrl(photo.src);
                      setDirty(true);
                    }}
                    className={cn(
                      "shrink-0 overflow-hidden rounded-[12px] border",
                      imageUrl === photo.src ? "border-gold" : "border-line",
                    )}
                  >
                    <img src={photo.src} alt={photo.label} className="h-14 w-20 object-cover" />
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="panel space-y-3 p-4">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <h2 className="font-display text-2xl">Tee set</h2>
              {course ? (
                <div className="flex flex-wrap gap-1">
                  {TEE_PRESETS.filter((p) => !tees.some((t) => t.name === p.name)).map((p) => (
                    <Button
                      key={p.name}
                      type="button"
                      size="sm"
                      variant="navy"
                      disabled={addTee.isPending}
                      onClick={() => addTee.mutate(p)}
                    >
                      Add {p.name}
                    </Button>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              {tees.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() =>
                    leave(() => {
                      loadedKey.current = "";
                      setTeeId(t.id);
                    })
                  }
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs uppercase tracking-[0.12em]",
                    teeId === t.id ? "border-gold text-gold" : "border-line",
                  )}
                >
                  <span className="size-2.5 rounded-full" style={{ background: t.color }} />
                  {t.name} · {t.yardage}
                </button>
              ))}
              {courseId === "new" ? (
                <span className="rounded-full border border-gold/40 px-3 py-2 text-xs uppercase tracking-[0.12em] text-gold">
                  {teeName}
                </span>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <Label>Tee name</Label>
                <Input
                  value={teeName}
                  onChange={(e) => {
                    setTeeName(e.target.value);
                    setDirty(true);
                  }}
                />
              </div>
              <div>
                <Label>Color</Label>
                <Input
                  value={teeColor}
                  onChange={(e) => {
                    setTeeColor(e.target.value);
                    setDirty(true);
                  }}
                />
              </div>
              <div>
                <Label>Course rating</Label>
                <Input
                  inputMode="decimal"
                  value={rating}
                  onChange={(e) => {
                    setRating(e.target.value);
                    setDirty(true);
                  }}
                />
              </div>
              <div>
                <Label>Slope</Label>
                <Input
                  inputMode="numeric"
                  value={slope}
                  onChange={(e) => {
                    setSlope(e.target.value);
                    setDirty(true);
                  }}
                />
              </div>
            </div>
            <p className="text-xs text-muted">
              Rating and slope are per tee. Course handicap is Index × Slope / 113 + (Rating − Par).
              Stroke index 1 is the hardest hole.
            </p>
          </section>

          <section className="panel p-0">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <h2 className="font-display text-2xl">18 holes</h2>
              <p className="text-xs uppercase tracking-[0.14em] text-gold">
                Par {totals.total.par} · {totals.total.yards} yds
              </p>
            </div>
            <div className="grid grid-cols-[2.25rem_4.5rem_minmax(0,1fr)_4.5rem] gap-2 border-b border-line px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-muted">
              <span className="text-center">No.</span>
              <span>Par</span>
              <span>Yards</span>
              <span className="text-center">SI</span>
            </div>
            <ol>
              {holes.map((h) => (
                <li key={h.number}>
                  <div
                    className={cn(
                      "grid grid-cols-[2.25rem_4.5rem_minmax(0,1fr)_4.5rem] items-center gap-2 px-3 py-1.5",
                      "border-b border-line/60",
                    )}
                  >
                    <span className="text-center tabular text-sm text-gold">{h.number}</span>
                    <input
                      aria-label={`Hole ${h.number} par`}
                      inputMode="numeric"
                      className="h-11 w-full min-w-0 rounded-[10px] border border-line bg-navy text-center text-sm tabular text-cream"
                      value={h.par || ""}
                      onChange={(e) => patchHole(h.number, { par: parseIntField(e.target.value) })}
                    />
                    <input
                      aria-label={`Hole ${h.number} yardage`}
                      inputMode="numeric"
                      className="h-11 w-full min-w-0 rounded-[10px] border border-line bg-navy px-2 text-sm tabular text-cream"
                      value={h.yardage || ""}
                      onChange={(e) => patchHole(h.number, { yardage: parseIntField(e.target.value) })}
                    />
                    <input
                      aria-label={`Hole ${h.number} stroke index`}
                      inputMode="numeric"
                      className={cn(
                        "h-11 w-full min-w-0 rounded-[10px] border bg-navy text-center text-sm tabular text-cream",
                        dupSi.has(h.strokeIndex) ? "border-orange text-orange" : "border-line",
                      )}
                      value={h.strokeIndex || ""}
                      onChange={(e) =>
                        patchHole(h.number, { strokeIndex: parseIntField(e.target.value) })
                      }
                    />
                  </div>
                  {h.number === 9 ? (
                    <p className="bg-navy-2 px-4 py-2 text-xs uppercase tracking-[0.14em] text-gold">
                      Out · Par {totals.front.par} · {totals.front.yards} yds
                    </p>
                  ) : null}
                  {h.number === 18 ? (
                    <p className="bg-navy-2 px-4 py-2 text-xs uppercase tracking-[0.14em] text-gold">
                      In · Par {totals.back.par} · {totals.back.yards} yds · Total {totals.total.par} /{" "}
                      {totals.total.yards}
                    </p>
                  ) : null}
                </li>
              ))}
            </ol>
          </section>

          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-1 size-4 accent-gold"
              checked={copyPar}
              onChange={(e) => setCopyPar(e.target.checked)}
            />
            Copy par and stroke index to every other tee on this course. Yardages stay on each tee.
          </label>

          {problem ? <p className="text-sm text-orange">{problem}</p> : null}

          <div className="sticky bottom-24 z-20 flex flex-col gap-2 md:bottom-8">
            <Button
              size="xl"
              className="w-full"
              disabled={Boolean(problem) || !name.trim() || save.isPending}
              onClick={() => save.mutate()}
            >
              {save.isPending ? "Saving…" : dirty || courseId === "new" ? "Save scorecard" : "Saved"}
            </Button>
          </div>

          {course && tees.length ? (
            <section className="panel space-y-3 p-4">
              <h2 className="font-display text-2xl">Attach to a round</h2>
              <p className="text-sm text-muted">
                Pairings and live scoring use the course and tee on the round. Change it here if the
                field moved.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <select
                  className="h-11 min-w-0 flex-1 rounded-[12px] border border-line bg-navy px-3 text-sm"
                  value={roundId}
                  onChange={(e) => setRoundId(e.target.value)}
                >
                  <option value="">Choose a round</option>
                  {data.rounds.map((r) => (
                    <option key={r.id} value={r.id}>
                      Round {r.round_number} · {r.name} · {r.status}
                    </option>
                  ))}
                </select>
                <Button variant="navy" disabled={!roundId || assign.isPending} onClick={() => assign.mutate()}>
                  Use this card
                </Button>
              </div>
              <ul className="text-xs text-muted">
                {data.rounds
                  .filter((r) => r.course_id === course.id)
                  .map((r) => (
                    <li key={r.id}>
                      Already on Round {r.round_number} ({r.tee_time})
                    </li>
                  ))}
              </ul>
            </section>
          ) : null}
        </>
      )}

      <Link to="/seth" className="block text-sm text-gold">
        Back to Seth Mode
      </Link>
    </div>
  );
}
