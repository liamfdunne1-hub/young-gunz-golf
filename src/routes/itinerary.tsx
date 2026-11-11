import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTrip, useMeQuery } from "@/lib/hooks";
import { getHouse } from "@/lib/server/api";

export const Route = createFileRoute("/itinerary")({ component: Itinerary });

function Itinerary() {
  const { data, isPending } = useTrip();
  const me = useMeQuery();
  const signedIn = Boolean(me.authUser);
  const claimed = Boolean(me.data?.player);
  const house = useQuery({
    queryKey: ["house", me.authUser?.id ?? "anon"],
    queryFn: () => getHouse(),
    enabled: signedIn,
  });
  if (isPending || !data) return <div className="h-40 animate-pulse rounded-[18px] bg-navy-2" />;

  const days = [...new Set(data.itinerary.map((i) => i.day))];
  return (
    <div className="space-y-8">
      <header>
        <p className="text-[11px] uppercase tracking-[0.22em] text-gold">November 11–15, 2026</p>
        <h1 className="font-display text-4xl">The Itinerary</h1>
        <p className="text-sm text-muted">This is the document. The group chat is not the document.</p>
      </header>
      <HouseCard signedIn={signedIn} house={house.data} />
      {data.announcements.length ? (
        <section className="panel p-4">
          <p className="text-[11px] uppercase tracking-[0.2em] text-gold">Mom’s Bulletin Board</p>
          <ul className="mt-3 space-y-3">
            {data.announcements.map((a) => (
              <li key={a.id}>
                <p className="text-sm">{a.title}</p>
                <p className="text-xs text-muted">{a.body}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {days.map((day) => {
        const items = data.itinerary.filter((i) => i.day === day);
        const d = new Date(`${day}T12:00:00`);
        const label = d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
        return (
          <section key={day}>
            <h2 className="mb-3 font-display text-2xl text-gold">{label}</h2>
            <ol className="space-y-3">
              {items.map((item) => {
                const course = data.courses.find((c) => c.id === item.course_id);
                const round = data.rounds.find((r) => r.id === item.round_id);
                return (
                  <li key={item.id} className="panel overflow-hidden">
                    {course?.image_url ? (
                      <img src={course.image_url} alt="" className="h-36 w-full object-cover" />
                    ) : null}
                    <div className="p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-gold">{item.start_time}</p>
                      <h3 className="font-display text-2xl">{item.title}</h3>
                      <p className="text-sm text-cream/80">{item.subtitle}</p>
                      <p className="mt-2 text-sm text-muted">{item.body}</p>
                      {round?.tee_time === "6:50 AM" ? (
                        <p className="mt-2 font-display text-xl text-orange">YES. 6:50 AM.</p>
                      ) : null}
                      {round?.theme?.includes("9:30") ? (
                        <p className="mt-2 text-sm text-gold">Requested: 9:30 AM. Reality: 8:12 AM. Thank you for your understanding.</p>
                      ) : null}
                      {course ? (
                        <Link
                          to="/courses/$slug"
                          params={{ slug: course.slug }}
                          className="mt-3 inline-block text-sm text-gold"
                        >
                          Course page
                        </Link>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}
    </div>
  );
}

function HouseCard({
  signedIn,
  house,
}: {
  signedIn: boolean;
  house?: {
    property: string;
    name: string;
    address: string;
    city: string;
    maps: string;
    wifi: { name: string; password: string };
    code: string;
  };
}) {
  if (!signedIn || !house) {
    return (
      <section className="panel p-4">
        <p className="text-[11px] uppercase tracking-[0.2em] text-gold">The house</p>
        <p className="mt-2 text-sm text-muted">
          Address, door code, and Wi-Fi are for signed-in players only.{" "}
          <Link to="/login" className="text-gold">
            Sign in
          </Link>{" "}
          to see them.
        </p>
      </section>
    );
  }
  return (
    <section className="panel p-4">
      <p className="text-[11px] uppercase tracking-[0.2em] text-gold">The house</p>
      <h2 className="mt-1 font-display text-2xl">{house.name}</h2>
      <p className="text-sm text-cream/80">{house.property}</p>
      <a href={house.maps} target="_blank" rel="noreferrer" className="mt-2 block text-sm text-gold">
        {house.address}
        <br />
        {house.city}
      </a>
      <div className="mt-4 space-y-1">
        <p className="text-[11px] uppercase tracking-[0.16em] text-gold">Door code</p>
        <p className="flex items-center gap-3 text-sm">
          <span className="tabular text-lg">{house.code}</span>
          <button
            type="button"
            className="text-xs uppercase tracking-[0.12em] text-gold"
            onClick={() => void navigator.clipboard?.writeText(house.code)}
          >
            Copy
          </button>
        </p>
      </div>
      <div className="mt-4 space-y-1">
        <p className="text-[11px] uppercase tracking-[0.16em] text-gold">Wi-Fi</p>
        <p className="text-sm">
          <span className="text-muted">Network</span> {house.wifi.name}
        </p>
        <p className="flex items-center gap-3 text-sm">
          <span className="text-muted">Password</span>
          <span className="tabular">{house.wifi.password}</span>
          <button
            type="button"
            className="text-xs uppercase tracking-[0.12em] text-gold"
            onClick={() => void navigator.clipboard?.writeText(house.wifi.password)}
          >
            Copy
          </button>
        </p>
      </div>
    </section>
  );
}
