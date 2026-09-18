import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { savePrefs } from "@/lib/server/api";
import { useMeQuery } from "@/lib/hooks";
import { Button } from "@/components/ui/button";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useState, useEffect } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({ component: Settings });

function Settings() {
  const { user, isPending } = useCurrentUserState();
  const me = useMeQuery();
  const qc = useQueryClient();
  const [prefs, setPrefs] = useState({
    pairings: true,
    tee_times: true,
    results: true,
    pools: true,
    announcements: true,
    recaps: true,
  });
  useEffect(() => {
    if (me.data?.prefs) setPrefs(me.data.prefs);
  }, [me.data?.prefs]);
  const mut = useMutation({
    mutationFn: () => savePrefs({ data: prefs }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me"] });
      toast("Preferences saved. Seth still has your number.");
    },
  });
  if (isPending) return null;
  if (!user) return <RedirectToSignIn />;
  const rows: { key: keyof typeof prefs; label: string }[] = [
    { key: "pairings", label: "Pairing changes" },
    { key: "tee_times", label: "Tee-time reminders" },
    { key: "results", label: "Results" },
    { key: "pools", label: "Pool updates" },
    { key: "announcements", label: "Seth’s announcements" },
    { key: "recaps", label: "Daily recaps" },
  ];
  return (
    <div className="space-y-4">
      <h1 className="font-display text-4xl">Email preferences</h1>
      <p className="text-sm text-muted">
        Critical itinerary information remains on this website regardless of how you feel about email. To
        change who you are on the field, use the{" "}
        <Link to="/locker" className="text-gold hover:underline">
          locker room
        </Link>
        .
      </p>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.key}>
            <label className="panel flex min-h-12 items-center justify-between px-4">
              <span>{r.label}</span>
              <input
                type="checkbox"
                className="size-5 accent-gold"
                checked={prefs[r.key]}
                onChange={(e) => setPrefs({ ...prefs, [r.key]: e.target.checked })}
              />
            </label>
          </li>
        ))}
      </ul>
      <Button onClick={() => mut.mutate()} disabled={!me.data?.player || mut.isPending}>
        Save
      </Button>
    </div>
  );
}
