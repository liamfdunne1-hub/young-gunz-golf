import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BookOpen,
  Camera,
  Flag,
  History,
  Lock,
  Mail,
  Plane,
  Settings,
  Trophy,
  Users,
  BarChart3,
  Newspaper,
  ScrollText,
  Shirt,
  Swords,
} from "lucide-react";

export const Route = createFileRoute("/more")({ component: More });

const LINKS = [
  { to: "/locker", label: "Locker room", icon: Shirt, note: "Claim a bag. Stop being Grok User." },
  { to: "/itinerary", label: "Itinerary", icon: BookOpen, note: "The tee time is here." },
  { to: "/players", label: "The Field", icon: Users, note: "Ten men. One commissioner." },
  { to: "/leaderboard", label: "Leaderboards", icon: Trophy, note: "Intergroup, match, gross, net. Also on the phone bar." },
  { to: "/matches", label: "Matches", icon: Swords, note: "Tee-time games and inter-tee matches. Vegas re-pairs from the landing." },
  { to: "/skins", label: "Skins", icon: Flag, note: "Gross. Unique low. Ties push. Not a bet." },
  { to: "/stats", label: "Statistics", icon: BarChart3, note: "Over-engineered on purpose." },
  { to: "/history", label: "Record Book", icon: History, note: "Holes won, lost, hardest, easiest, worst." },
  { to: "/pairings", label: "Pairings", icon: Flag, note: "Tee times first. Then the match. Draft until Seth publishes." },
  { to: "/ledger", label: "Public ledger", icon: ScrollText, note: "The Action tab. Not skins." },
  { to: "/flights", label: "Flights", icon: Plane, note: "Seth is watching the arrivals board." },
  { to: "/evidence", label: "The Evidence", icon: Camera, note: "Photographic regrets." },
  { to: "/recaps", label: "Recaps", icon: Newspaper, note: "ESPN for a trip that did not need it." },
  { to: "/results", label: "Official Results", icon: Trophy, note: "Locked after Survival Sunday." },
  { to: "/notifications", label: "Notifications", icon: Mail, note: "Seth, but quieter." },
  { to: "/settings", label: "Preferences", icon: Settings, note: "Email Seth less. Or more." },
];

function More() {
  return (
    <div className="space-y-4">
      <h1 className="font-display text-4xl">More</h1>
      <p className="text-sm text-muted">If you are looking for the tee time, it is on the itinerary. Please stop asking Seth.</p>
      <Link to="/seth" className="panel flex items-center gap-3 p-4">
        <Lock className="text-gold" />
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-gold">Young Gunz Command Center</p>
          <p className="font-display text-2xl text-cream">Seth Mode</p>
          <p className="text-xs text-muted">Anyone with the door code. You do not have to be Seth.</p>
        </div>
      </Link>
      <div className="grid gap-2">
        {LINKS.map((l) => {
          const Icon = l.icon;
          return (
            <Link key={l.to} to={l.to} className="panel flex items-center gap-3 p-4">
              <Icon size={18} className="text-gold" />
              <div>
                <p className="text-sm">{l.label}</p>
                <p className="text-xs text-muted">{l.note}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
