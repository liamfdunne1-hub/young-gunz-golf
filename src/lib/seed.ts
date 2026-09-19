import type { Sql } from "@/lib/db";
import { playingHandicap, courseHandicap } from "@/lib/golf/handicap";
import { DEFAULT_MATCH_STAKE } from "@/lib/golf/bets";
import { DEFAULT_SKINS_POT } from "@/lib/golf/skins";
import { DEFAULT_SETH_PASSCODE, hashPasscode } from "@/lib/server/seth";

type Hole = { par: number; yards: number; si: number };

const WALDORF: Hole[] = [
	{
		par: 4,
		yards: 388,
		si: 9
	},
	{
		par: 3,
		yards: 173,
		si: 17
	},
	{
		par: 4,
		yards: 428,
		si: 5
	},
	{
		par: 5,
		yards: 558,
		si: 7
	},
	{
		par: 4,
		yards: 395,
		si: 13
	},
	{
		par: 4,
		yards: 478,
		si: 3
	},
	{
		par: 3,
		yards: 206,
		si: 15
	},
	{
		par: 5,
		yards: 509,
		si: 1
	},
	{
		par: 4,
		yards: 414,
		si: 11
	},
	{
		par: 4,
		yards: 372,
		si: 12
	},
	{
		par: 3,
		yards: 239,
		si: 14
	},
	{
		par: 5,
		yards: 623,
		si: 4
	},
	{
		par: 4,
		yards: 321,
		si: 16
	},
	{
		par: 4,
		yards: 432,
		si: 6
	},
	{
		par: 4,
		yards: 392,
		si: 10
	},
	{
		par: 3,
		yards: 171,
		si: 18
	},
	{
		par: 4,
		yards: 481,
		si: 2
	},
	{
		par: 5,
		yards: 528,
		si: 8
	}
];
const PALM: Hole[] = [
	{
		par: 4,
		yards: 394,
		si: 7
	},
	{
		par: 4,
		yards: 410,
		si: 5
	},
	{
		par: 3,
		yards: 188,
		si: 15
	},
	{
		par: 5,
		yards: 535,
		si: 9
	},
	{
		par: 4,
		yards: 421,
		si: 3
	},
	{
		par: 4,
		yards: 365,
		si: 13
	},
	{
		par: 3,
		yards: 162,
		si: 17
	},
	{
		par: 5,
		yards: 548,
		si: 1
	},
	{
		par: 4,
		yards: 402,
		si: 11
	},
	{
		par: 4,
		yards: 430,
		si: 4
	},
	{
		par: 5,
		yards: 512,
		si: 10
	},
	{
		par: 3,
		yards: 175,
		si: 16
	},
	{
		par: 4,
		yards: 387,
		si: 8
	},
	{
		par: 4,
		yards: 355,
		si: 14
	},
	{
		par: 5,
		yards: 560,
		si: 2
	},
	{
		par: 3,
		yards: 198,
		si: 12
	},
	{
		par: 4,
		yards: 416,
		si: 6
	},
	{
		par: 4,
		yards: 463,
		si: 18
	}
];
const MAGNOLIA: Hole[] = [
	{
		par: 4,
		yards: 428,
		si: 7
	},
	{
		par: 5,
		yards: 552,
		si: 11
	},
	{
		par: 4,
		yards: 401,
		si: 5
	},
	{
		par: 3,
		yards: 192,
		si: 15
	},
	{
		par: 4,
		yards: 445,
		si: 1
	},
	{
		par: 4,
		yards: 378,
		si: 13
	},
	{
		par: 5,
		yards: 580,
		si: 3
	},
	{
		par: 3,
		yards: 168,
		si: 17
	},
	{
		par: 4,
		yards: 412,
		si: 9
	},
	{
		par: 4,
		yards: 436,
		si: 4
	},
	{
		par: 5,
		yards: 565,
		si: 8
	},
	{
		par: 3,
		yards: 205,
		si: 14
	},
	{
		par: 4,
		yards: 390,
		si: 12
	},
	{
		par: 4,
		yards: 418,
		si: 6
	},
	{
		par: 5,
		yards: 541,
		si: 10
	},
	{
		par: 3,
		yards: 181,
		si: 16
	},
	{
		par: 4,
		yards: 452,
		si: 2
	},
	{
		par: 4,
		yards: 467,
		si: 18
	}
];
const DUNES: Hole[] = [
	{
		par: 4,
		yards: 421,
		si: 7
	},
	{
		par: 4,
		yards: 398,
		si: 11
	},
	{
		par: 3,
		yards: 186,
		si: 15
	},
	{
		par: 5,
		yards: 568,
		si: 3
	},
	{
		par: 4,
		yards: 445,
		si: 1
	},
	{
		par: 3,
		yards: 164,
		si: 17
	},
	{
		par: 4,
		yards: 412,
		si: 9
	},
	{
		par: 4,
		yards: 387,
		si: 13
	},
	{
		par: 5,
		yards: 542,
		si: 5
	},
	{
		par: 4,
		yards: 430,
		si: 4
	},
	{
		par: 3,
		yards: 201,
		si: 14
	},
	{
		par: 5,
		yards: 575,
		si: 2
	},
	{
		par: 4,
		yards: 365,
		si: 16
	},
	{
		par: 3,
		yards: 172,
		si: 18
	},
	{
		par: 4,
		yards: 408,
		si: 8
	},
	{
		par: 5,
		yards: 551,
		si: 6
	},
	{
		par: 4,
		yards: 392,
		si: 12
	},
	{
		par: 4,
		yards: 410,
		si: 10
	}
];
const PROVIDENCE: Hole[] = [
	{
		par: 4,
		yards: 405,
		si: 9
	},
	{
		par: 5,
		yards: 538,
		si: 5
	},
	{
		par: 4,
		yards: 392,
		si: 13
	},
	{
		par: 3,
		yards: 178,
		si: 15
	},
	{
		par: 4,
		yards: 418,
		si: 3
	},
	{
		par: 4,
		yards: 425,
		si: 1
	},
	{
		par: 5,
		yards: 555,
		si: 7
	},
	{
		par: 3,
		yards: 161,
		si: 17
	},
	{
		par: 4,
		yards: 388,
		si: 11
	},
	{
		par: 4,
		yards: 412,
		si: 8
	},
	{
		par: 3,
		yards: 195,
		si: 14
	},
	{
		par: 5,
		yards: 542,
		si: 4
	},
	{
		par: 4,
		yards: 376,
		si: 16
	},
	{
		par: 4,
		yards: 401,
		si: 10
	},
	{
		par: 3,
		yards: 170,
		si: 18
	},
	{
		par: 5,
		yards: 528,
		si: 6
	},
	{
		par: 4,
		yards: 390,
		si: 12
	},
	{
		par: 4,
		yards: 437,
		si: 2
	}
];
type PlayerSeed = {
  first: string;
  last: string;
  nickname: string;
  email: string;
  slug: string;
  role: "admin" | "player";
  index: number;
  tee: string;
  report: string;
  threat: string | null;
  metrics: Record<string, number>;
};

const PLAYERS: PlayerSeed[] = [
	{
		first: "Seth",
		last: "Young",
		nickname: "The Commissioner",
		email: "seth.young@younggunz.golf",
		slug: "seth-young",
		role: "admin",
		index: 4.1,
		tee: "Blue",
		report: "Trip commissioner. Controls the itinerary, pairings and potentially your access to transportation. Complaining about a ruling is therefore discouraged.",
		threat: "ADMINISTRATIVE",
		metrics: {
			driving: 72,
			irons: 74,
			putting: 68,
			alcohol: 55,
			lipOut: 40,
			thatsGood: 35,
			breakfastBall: 20,
			cart: 95,
			wakeup: 99,
			loseSomething: 12,
			sethDependency: 0
		}
	},
	{
		first: "Liam",
		last: "Dunne",
		nickname: "Volatility Inc.",
		email: "liam.dunne@younggunz.golf",
		slug: "liam-dunne",
		role: "player",
		index: 7.2,
		tee: "Blue",
		report: "Dangerous combination of enough ability to win and enough volatility to shoot 84 while explaining why every shot was actually pretty good.",
		threat: "MOOD-DEPENDENT",
		metrics: {
			driving: 64,
			irons: 61,
			putting: 58,
			alcohol: 72,
			lipOut: 81,
			thatsGood: 70,
			breakfastBall: 74,
			cart: 50,
			wakeup: 38,
			loseSomething: 66,
			sethDependency: 78
		}
	},
	{
		first: "John",
		last: "V",
		nickname: "The Search Party",
		email: "john.v@younggunz.golf",
		slug: "john-v",
		role: "player",
		index: 6.5,
		tee: "Blue",
		report: "Firmly in the zone where he can beat anyone or spend six holes trying to figure out where his swing went.",
		threat: "UNPREDICTABLE",
		metrics: {
			driving: 68,
			irons: 55,
			putting: 62,
			alcohol: 60,
			lipOut: 64,
			thatsGood: 58,
			breakfastBall: 55,
			cart: 62,
			wakeup: 48,
			loseSomething: 71,
			sethDependency: 61
		}
	},
	{
		first: "Kyle",
		last: "Longacre",
		nickname: "Single Digit",
		email: "kyle.longacre@younggunz.golf",
		slug: "kyle-longacre",
		role: "player",
		index: 5,
		tee: "Blue",
		report: "Single-digit handicap. Almost certainly believes this information should matter more than it does.",
		threat: "CREDENTIALED",
		metrics: {
			driving: 70,
			irons: 72,
			putting: 60,
			alcohol: 52,
			lipOut: 58,
			thatsGood: 44,
			breakfastBall: 30,
			cart: 68,
			wakeup: 64,
			loseSomething: 28,
			sethDependency: 41
		}
	},
	{
		first: "Zac",
		last: "Novak",
		nickname: "The Problem",
		email: "zac.novak@younggunz.golf",
		slug: "zac-novak",
		role: "player",
		index: -1.4,
		tee: "Black",
		report: "Statistically the golfer everyone else wishes had stayed home.",
		threat: "EXTREMELY ANNOYING",
		metrics: {
			driving: 94,
			irons: 91,
			putting: 88,
			alcohol: 42,
			lipOut: 18,
			thatsGood: 12,
			breakfastBall: 4,
			cart: 86,
			wakeup: 80,
			loseSomething: 9,
			sethDependency: 8
		}
	},
	{
		first: "Nick",
		last: "Prell",
		nickname: "Index Watch",
		email: "nick.prell@younggunz.golf",
		slug: "nick-prell",
		role: "player",
		index: 2.3,
		tee: "Blue",
		report: "Good enough that nobody wants to give him strokes. Not good enough to stop talking about his handicap.",
		threat: "PEDANTIC",
		metrics: {
			driving: 82,
			irons: 80,
			putting: 74,
			alcohol: 48,
			lipOut: 55,
			thatsGood: 28,
			breakfastBall: 16,
			cart: 77,
			wakeup: 70,
			loseSomething: 22,
			sethDependency: 33
		}
	},
	{
		first: "Robert",
		last: "Robinson",
		nickname: "Stroke Debate",
		email: "robert.robinson@younggunz.golf",
		slug: "robert-robinson",
		role: "player",
		index: 6.9,
		tee: "Blue",
		report: "Golf handicap perfectly engineered to create arguments about how many strokes he should receive.",
		threat: "PROCEDURAL",
		metrics: {
			driving: 60,
			irons: 63,
			putting: 66,
			alcohol: 58,
			lipOut: 72,
			thatsGood: 80,
			breakfastBall: 62,
			cart: 54,
			wakeup: 44,
			loseSomething: 48,
			sethDependency: 69
		}
	},
	{
		first: "Drew",
		last: "Schneider",
		nickname: "Low Amateur",
		email: "drew.schneider@younggunz.golf",
		slug: "drew-schneider",
		role: "player",
		index: 1.4,
		tee: "Black",
		report: "Another low handicap because apparently this trip needed multiple people capable of breaking 75.",
		threat: "COMPETENT",
		metrics: {
			driving: 86,
			irons: 84,
			putting: 79,
			alcohol: 50,
			lipOut: 32,
			thatsGood: 22,
			breakfastBall: 10,
			cart: 81,
			wakeup: 76,
			loseSomething: 18,
			sethDependency: 21
		}
	},
	{
		first: "Addison",
		last: "Shelton",
		nickname: "Bad News",
		email: "addison.shelton@younggunz.golf",
		slug: "addison-shelton",
		role: "player",
		index: 2,
		tee: "Blue",
		report: "Two handicap. Terrible news for everyone else.",
		threat: "QUIETLY LETHAL",
		metrics: {
			driving: 84,
			irons: 83,
			putting: 81,
			alcohol: 46,
			lipOut: 29,
			thatsGood: 18,
			breakfastBall: 8,
			cart: 79,
			wakeup: 73,
			loseSomething: 15,
			sethDependency: 19
		}
	},
	{
		first: "Julian",
		last: "Turman",
		nickname: "Enough Strokes",
		email: "julian.turman@younggunz.golf",
		slug: "julian-turman",
		role: "player",
		index: 5.9,
		tee: "Blue",
		report: "Just enough handicap to receive strokes from the good players while still being capable of ruining their day.",
		threat: "SANDWICHED",
		metrics: {
			driving: 66,
			irons: 69,
			putting: 64,
			alcohol: 63,
			lipOut: 60,
			thatsGood: 52,
			breakfastBall: 48,
			cart: 58,
			wakeup: 42,
			loseSomething: 57,
			sethDependency: 72
		}
	}
];
async function insertHoles(sql: Sql, teeId: number, holes: Hole[]) {
	for (const [i, h] of holes.entries()) await sql`
      insert into holes (tee_id, number, par, yardage, stroke_index)
      values (${teeId}, ${i + 1}, ${h.par}, ${h.yards}, ${h.si})
    `;
}
const globalSeed = globalThis as typeof globalThis & { __ygSeedPromiseV3__?: Promise<void> };
export async function ensureSeeded(sql: Sql) {
	globalSeed.__ygSeedPromiseV3__ ??= (async () => {
		const existing = await sql<{ id: number }>`select id from trips limit 1`;
		if (existing.length) {
			await patchTripSettings(sql);
			return;
		}
		await seed(sql);
		await patchTripSettings(sql);
	})().catch((err) => {
		globalSeed.__ygSeedPromiseV3__ = undefined;
		throw err;
	});
	await globalSeed.__ygSeedPromiseV3__;
}
async function patchTripSettings(sql: Sql) {
	await sql`
    update trips
    set seth_passcode_hash = coalesce(seth_passcode_hash, ${hashPasscode(DEFAULT_SETH_PASSCODE)}),
        match_stake = coalesce(match_stake, ${DEFAULT_MATCH_STAKE}),
        skins_pot = coalesce(skins_pot, ${DEFAULT_SKINS_POT})
  `;
	await sql`update rounds set allowance_pct = 90 where allowance_pct = 100`;
}
async function seed(sql: Sql) {
	const [trip] = await sql<{ id: number }>`
    insert into trips (slug, name, location, start_date, end_date, tagline, status)
    values (
      'orlando-2026',
      'Young Gunz Orlando 2026',
      'Orlando, Florida',
      '2026-11-11',
      '2026-11-15',
      'Ten Golfers. Five Rounds. Zero Accountability.',
      'upcoming'
    )
    returning id
  `;
	const tripId = trip.id;
	const playerIds: Record<string, number> = {};
	for (const p of PLAYERS) {
		const ch = courseHandicap(p.index, 131, 72.9, 72);
		const ph = playingHandicap(ch);
		const [row] = await sql<{ id: number }>`
      insert into players (
        trip_id, first_name, last_name, nickname, email, slug, role,
        handicap_index, course_handicap, playing_handicap, tee_name,
        scouting_report, threat_level, joke_metrics, invite_token, invited_at
      ) values (
        ${tripId}, ${p.first}, ${p.last}, ${p.nickname}, ${p.email}, ${p.slug}, ${p.role},
        ${p.index}, ${ch}, ${ph}, ${p.tee},
        ${p.report}, ${p.threat}, ${JSON.stringify(p.metrics)}::jsonb,
        ${crypto.randomUUID()}, now()
      )
      returning id
    `;
		playerIds[p.slug] = row.id;
		await sql`insert into notification_prefs (player_id) values (${row.id})`;
	}
	async function addCourse(args: {
    name: string;
    slug: string;
    address: string;
    city: string;
    designer: string;
    image: string;
    par: number;
    description: string;
    theme: string;
    tees: { name: string; color: string; rating: number; slope: number; holes: Hole[] }[];
  }) {
		const [course] = await sql<{ id: number }>`
      insert into courses (trip_id, name, slug, address, city, designer, image_url, par, description, theme)
      values (
        ${tripId}, ${args.name}, ${args.slug}, ${args.address}, ${args.city},
        ${args.designer}, ${args.image}, ${args.par}, ${args.description}, ${args.theme}
      )
      returning id
    `;
		const teeIds: Record<string, number> = {};
		for (const t of args.tees) {
			const yardage = t.holes.reduce((s, h) => s + h.yards, 0);
			const [tee] = await sql<{ id: number }>`
        insert into tees (course_id, name, color, rating, slope, yardage)
        values (${course.id}, ${t.name}, ${t.color}, ${t.rating}, ${t.slope}, ${yardage})
        returning id
      `;
			teeIds[t.name] = tee.id;
			await insertHoles(sql, tee.id, t.holes);
		}
		return {
			courseId: course.id,
			teeIds
		};
	}
	const waldorf = await addCourse({
		name: "Waldorf Astoria Golf Club",
		slug: "waldorf-astoria",
		address: "14200 Bonnet Creek Resort Lane",
		city: "Orlando, FL 32821",
		designer: "Rees Jones",
		image: "/images/waldorf.jpg",
		par: 72,
		theme: "Welcome to Florida.",
		description: "A Rees Jones design through the Bonnet Creek preserve. Cypress, water, and the first official opportunity to blame the Bermuda.",
		tees: [{
			name: "Black",
			color: "#111111",
			rating: 74.9,
			slope: 134,
			holes: WALDORF
		}, {
			name: "Blue",
			color: "#1e4b8c",
			rating: 72.9,
			slope: 131,
			holes: WALDORF.map((h) => ({
				...h,
				yards: Math.round(h.yards * .936)
			}))
		}]
	});
	const palm = await addCourse({
		name: "Disney’s Palm Golf Course",
		slug: "disney-palm",
		address: "1950 W Magnolia Palm Drive",
		city: "Lake Buena Vista, FL 32830",
		designer: "Joe Lee / Arnold Palmer Group",
		image: "/images/palm.jpg",
		par: 72,
		theme: "YES. 6:50 AM.",
		description: "Water on nine holes and a 6:50 AM tee time. Hydration is technically recommended. Consciousness is required.",
		tees: [{
			name: "Black",
			color: "#111111",
			rating: 73.9,
			slope: 131,
			holes: PALM
		}, {
			name: "Blue",
			color: "#1e4b8c",
			rating: 71.8,
			slope: 128,
			holes: PALM.map((h) => ({
				...h,
				yards: Math.round(h.yards * .94)
			}))
		}]
	});
	const magnolia = await addCourse({
		name: "Disney’s Magnolia Golf Course",
		slug: "disney-magnolia",
		address: "1950 W Magnolia Palm Drive",
		city: "Lake Buena Vista, FL 32830",
		designer: "Joe Lee",
		image: "/images/magnolia.jpg",
		par: 72,
		theme: "36-hole day. Hydration is technically recommended.",
		description: "The longest Disney course. Wide fairways, 97 bunkers, water on eleven holes, and the small matter of already having played 18 this morning.",
		tees: [{
			name: "Black",
			color: "#111111",
			rating: 76,
			slope: 141,
			holes: MAGNOLIA
		}, {
			name: "Blue",
			color: "#1e4b8c",
			rating: 74,
			slope: 137,
			holes: MAGNOLIA.map((h) => ({
				...h,
				yards: Math.round(h.yards * .944)
			}))
		}]
	});
	const dunes = await addCourse({
		name: "Southern Dunes Golf & Country Club",
		slug: "southern-dunes",
		address: "2888 Southern Dunes Boulevard",
		city: "Haines City, FL 33844",
		designer: "Steve Smyers",
		image: "/images/dunes.jpg",
		par: 72,
		theme: "Requested: 9:30 AM. Reality: 8:12 AM.",
		description: "Mounding, waste bunkers, and a tee time nobody asked for. Thank you for your understanding.",
		tees: [{
			name: "Black",
			color: "#111111",
			rating: 75.5,
			slope: 138,
			holes: DUNES
		}, {
			name: "Blue",
			color: "#1e4b8c",
			rating: 73.3,
			slope: 134,
			holes: DUNES.map((h) => ({
				...h,
				yards: Math.round(h.yards * .941)
			}))
		}]
	});
	const providence = await addCourse({
		name: "Providence Golf Club",
		slug: "providence",
		address: "1518 Clubhouse Boulevard",
		city: "Davenport, FL 33837",
		designer: "Mike Dasher",
		image: "/images/providence.jpg",
		par: 72,
		theme: "SURVIVAL SUNDAY",
		description: "Voted a Central Florida favorite, which will not be mentioned if the scoring gets ugly. Last chance to ruin or rescue a trip.",
		tees: [{
			name: "Black",
			color: "#111111",
			rating: 74.5,
			slope: 132,
			holes: PROVIDENCE
		}, {
			name: "Blue",
			color: "#1e4b8c",
			rating: 71.1,
			slope: 127,
			holes: PROVIDENCE.map((h) => ({
				...h,
				yards: Math.round(h.yards * .917)
			}))
		}]
	});
	const roundDefs = [
		{
			n: 1,
			name: "Round 1",
			date: "2026-11-12",
			teeTime: "9:00 AM",
			course: waldorf,
			theme: "Welcome to Florida.",
			notes: "Ten players. One opening statement."
		},
		{
			n: 2,
			name: "Round 2",
			date: "2026-11-13",
			teeTime: "6:50 AM",
			course: palm,
			theme: "YES. 6:50 AM.",
			notes: "Time until Seth starts texting everyone: insufficient."
		},
		{
			n: 3,
			name: "Round 3",
			date: "2026-11-13",
			teeTime: "12:40 PM",
			course: magnolia,
			theme: "36-hole day. Hydration is technically recommended.",
			notes: "The Disney Doubleheader, second shift."
		},
		{
			n: 4,
			name: "Round 4",
			date: "2026-11-14",
			teeTime: "8:12 AM",
			course: dunes,
			theme: "Requested: 9:30 AM. Reality: 8:12 AM.",
			notes: "Thank you for your understanding."
		},
		{
			n: 5,
			name: "Round 5",
			date: "2026-11-15",
			teeTime: "8:32 AM",
			course: providence,
			theme: "SURVIVAL SUNDAY",
			notes: "Unlike the pairings, this one is actually the last one."
		}
	];
	const roundIds: number[] = [];
	for (const r of roundDefs) {
		const [row] = await sql<{ id: number }>`
      insert into rounds (
        trip_id, course_id, tee_id, round_number, name, date, tee_time, theme, notes, status, pairings_status, allowance_pct
      ) values (
        ${tripId}, ${r.course.courseId}, ${r.course.teeIds.Blue}, ${r.n}, ${r.name},
        ${r.date}, ${r.teeTime}, ${r.theme}, ${r.notes}, 'upcoming', 'draft', 90
      )
      returning id
    `;
		roundIds.push(row.id);
		for (const n of [
			1,
			2,
			3
		]) await sql`insert into groups (round_id, group_number) values (${row.id}, ${n})`;
	}
	const itinerary = [
		{
			day: "2026-11-11",
			time: "Evening",
			title: "Arrival Night",
			subtitle: "Everyone flies into Orlando the night before golf begins.",
			body: "Land, find your bag, text Seth even though the itinerary already answered you, and locate the bar. Status updates live on the arrival board.",
			kind: "arrival",
			sort: 10
		},
		{
			day: "2026-11-12",
			time: "9:00 AM",
			title: "Round 1 — Waldorf Astoria Golf Club",
			subtitle: "Welcome to Florida.",
			body: "Ten players. Flexible groups. Pairings not yet announced, because Seth is still thinking about it.",
			kind: "round",
			round: 0,
			courseId: waldorf.courseId,
			sort: 20
		},
		{
			day: "2026-11-13",
			time: "6:50 AM",
			title: "Round 2 — Disney’s Palm",
			subtitle: "YES. 6:50 AM.",
			body: "The Disney Doubleheader begins at an hour that should be illegal. Seth will have been awake for 90 minutes.",
			kind: "round",
			round: 1,
			courseId: palm.courseId,
			sort: 30
		},
		{
			day: "2026-11-13",
			time: "12:40 PM",
			title: "Round 3 — Disney’s Magnolia",
			subtitle: "36-hole day.",
			body: "Hydration is technically recommended. Complaining is not.",
			kind: "round",
			round: 2,
			courseId: magnolia.courseId,
			sort: 40
		},
		{
			day: "2026-11-14",
			time: "8:12 AM",
			title: "Round 4 — Southern Dunes",
			subtitle: "Requested: 9:30 AM. Reality: 8:12 AM.",
			body: "Life comes at you fast. The tee time is on this website.",
			kind: "round",
			round: 3,
			courseId: dunes.courseId,
			sort: 50
		},
		{
			day: "2026-11-15",
			time: "8:32 AM",
			title: "Round 5 — Providence Golf Club",
			subtitle: "SURVIVAL SUNDAY",
			body: "Last round. Last chance. Then the Damage Report.",
			kind: "round",
			round: 4,
			courseId: providence.courseId,
			sort: 60
		},
		{
			day: "2026-11-15",
			time: "Afternoon",
			title: "Departures",
			subtitle: "Go home. Reflect. Do not ask Seth if you can add a sixth round.",
			body: "Enter your outbound flight so Mom can stop guessing who is still in the state.",
			kind: "departure",
			sort: 70
		}
	];
	for (const item of itinerary) await sql`
      insert into itinerary_items (
        trip_id, day, start_time, title, subtitle, body, kind, course_id, round_id, sort
      ) values (
        ${tripId}, ${item.day}, ${item.time}, ${item.title}, ${item.subtitle}, ${item.body},
        ${item.kind}, ${item.courseId ?? null}, ${item.round != null ? roundIds[item.round] : null}, ${item.sort}
      )
    `;
	for (const a of [
		{
			title: "Be downstairs at 7:15 means downstairs at 7:15.",
			body: "If you are in the elevator at 7:15 you are late. If you are asking what time we are leaving you are also late.",
			important: true
		},
		{
			title: "Charge your phone.",
			body: "Live scoring does not work on a dead battery, and neither does calling Seth from the parking lot.",
			important: false
		},
		{
			title: "Bring sunscreen.",
			body: "No, I do not know where your rangefinder is. It is not in my bag. It is not in the group chat. Look in your own suitcase.",
			important: false
		},
		{
			title: "Your tee time has not changed.",
			body: "It has not changed since the last four times you asked. It is on the itinerary. It is on this website. Please stop asking Seth.",
			important: true
		}
	]) await sql`
      insert into announcements (trip_id, author_player_id, title, body, important)
      values (${tripId}, ${playerIds['seth-young']}, ${a.title}, ${a.body}, ${a.important})
    `;
	const [lowGross] = await sql<{ id: number }>`
    insert into markets (trip_id, name, kind, status)
    values (${tripId}, 'Trip Low Gross', 'trip_low_gross', 'open')
    returning id
  `;
	const [lowNet] = await sql<{ id: number }>`
    insert into markets (trip_id, name, kind, status)
    values (${tripId}, 'Trip Low Net', 'trip_low_net', 'open')
    returning id
  `;
	const [matchPts] = await sql<{ id: number }>`
    insert into markets (trip_id, name, kind, status)
    values (${tripId}, 'Match Points Champion', 'match_points', 'open')
    returning id
  `;
	for (const marketId of [
		lowGross.id,
		lowNet.id,
		matchPts.id
	]) {
		for (const p of PLAYERS) await sql`
        insert into market_selections (market_id, label, player_id)
        values (${marketId}, ${`${p.first} ${p.last}`}, ${playerIds[p.slug]})
      `;
		await sql`
      insert into market_selections (market_id, label, player_id)
      values (${marketId}, 'The Field', null)
    `;
	}
	for (const [name, description, category] of [
		[
			"Low Gross Champion",
			"Lowest combined gross for the trip.",
			"major"
		],
		[
			"Low Net Champion",
			"Lowest combined net for the trip.",
			"major"
		],
		[
			"Match Play Champion",
			"Most match points.",
			"major"
		],
		[
			"Birdie King",
			"Most birdies. Zac is not allowed to look smug.",
			"major"
		],
		[
			"The Young Gun Award",
			"For the player who still thinks this is a big deal.",
			"fun"
		],
		[
			"The Old Man Award",
			"Earliest bedtime. Loudest knees.",
			"fun"
		],
		[
			"Most Dangerous After Two Beers",
			"Self-explanatory. Will be observed.",
			"fun"
		],
		[
			"Most Creative Interpretation of Out of Bounds",
			"If you can argue it, you can win it.",
			"fun"
		],
		[
			"Most Likely to Blame the Greens",
			"They were fine.",
			"fun"
		],
		[
			"The “I Had That Line” Award",
			"You did not.",
			"fun"
		],
		[
			"The “That Never Happens at My Home Course” Award",
			"It happens everywhere.",
			"fun"
		],
		[
			"Most Dependent on Seth",
			"Ask Seth button leader. This is not an honor.",
			"fun"
		],
		[
			"Skins King",
			"Most unique-low holes. Ties never counted.",
			"major"
		],
		[
			"Most Holes Won",
			"Match-play holes taken. Halves do not impress anyone.",
			"major"
		],
		[
			"The Blow-Up Award",
			"Highest number posted on a single hole. Congratulations.",
			"fun"
		],
		[
			"Most Doubles",
			"Double bogey or worse. Volume scoring.",
			"fun"
		]
	]) await sql`
      insert into awards (trip_id, name, description, category)
      values (${tripId}, ${name}, ${description}, ${category})
    `;
	await sql`
    insert into photos (trip_id, url, caption, featured)
    values
      (${tripId}, '/images/hero.jpg', 'Florida, whether you are ready or not.', true),
      (${tripId}, '/images/waldorf.jpg', 'Waldorf Astoria — Round 1.', true),
      (${tripId}, '/images/palm.jpg', 'The Palm. 6:50 AM. Bring a light.', false),
      (${tripId}, '/images/magnolia.jpg', 'Magnolia. The long one.', false),
      (${tripId}, '/images/dunes.jpg', 'Southern Dunes. Requested 9:30.', false),
      (${tripId}, '/images/providence.jpg', 'Survival Sunday.', false)
  `;
}
