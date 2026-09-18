import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ClipboardList, X } from "lucide-react";
import { toast } from "sonner";
import { askSeth } from "@/lib/server/api";
import { Button } from "@/components/ui/button";
import { useMeQuery } from "@/lib/hooks";

const CHECKS = [
  "The itinerary?",
  "Your tee time?",
  "Your pairing?",
  "The group chat?",
  "Literally this website?",
];

export function AskSeth() {
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState<boolean[]>(() => CHECKS.map(() => false));
  const me = useMeQuery();
  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: () => askSeth(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trip"] });
      qc.invalidateQueries({ queryKey: ["me"] });
      toast("Seth has been notified. He is already disappointed.");
      setOpen(false);
      setChecked(CHECKS.map(() => false));
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const all = checked.every(Boolean);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed right-4 z-40 flex h-12 items-center gap-2 rounded-full border border-gold/40 bg-navy-2 px-4 text-xs uppercase tracking-[0.16em] text-gold shadow-panel bottom-[calc(5.5rem+env(safe-area-inset-bottom))] md:bottom-6"
      >
        <ClipboardList size={16} />
        Ask Seth
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-end bg-ink/70 p-4 md:place-items-center">
          <div className="panel w-full max-w-md p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-gold">Before asking Seth</p>
                <h2 className="font-display text-2xl text-cream">Did you check</h2>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="text-muted hover:text-cream">
                <X size={18} />
              </button>
            </div>
            <ul className="space-y-2">
              {CHECKS.map((c, i) => (
                <li key={c}>
                  <label className="flex min-h-11 items-center gap-3 rounded-[12px] border border-line px-3 text-sm">
                    <input
                      type="checkbox"
                      checked={checked[i]}
                      onChange={(e) =>
                        setChecked((prev) => prev.map((v, j) => (j === i ? e.target.checked : v)))
                      }
                      className="size-4 accent-gold"
                    />
                    {c}
                  </label>
                </li>
              ))}
            </ul>
            <Button
              className="mt-4 w-full"
              disabled={!all || !me.data?.player || mut.isPending}
              onClick={() => mut.mutate()}
            >
              Yes, I still need Seth
            </Button>
            {all ? (
              <a
                href="mailto:seth.young@younggunz.golf"
                className="mt-3 block text-center text-sm text-gold"
              >
                Fine. Email the Commissioner.
              </a>
            ) : null}
            {!me.data?.player ? (
              <p className="mt-3 text-xs text-muted">Sign in as a golfer to officially bother the Commissioner.</p>
            ) : (
              <p className="mt-3 text-xs text-muted">
                This is tracked. The Most Dependent on Seth leaderboard is watching.
              </p>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
