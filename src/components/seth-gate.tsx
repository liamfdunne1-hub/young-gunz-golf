import { useEffect, useState, type ReactNode } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useMeQuery } from "@/lib/hooks";
import { unlockSethMode } from "@/lib/server/api";
import { isSethUnlocked, setSethUnlocked } from "@/lib/seth-session";

export function SethGate({ children }: { children: ReactNode }) {
  const { user, isPending } = useCurrentUserState();
  const me = useMeQuery();
  const [gate, setGate] = useState<"boot" | "locked" | "open">("boot");
  const [code, setCode] = useState("");

  useEffect(() => {
    if (isPending || !me.isFetched) return;
    setGate(me.data?.isAdmin && isSethUnlocked() ? "open" : "locked");
  }, [isPending, me.isFetched, me.data?.isAdmin]);

  const unlock = useMutation({
    mutationFn: () => unlockSethMode({ data: { passcode: code } }),
    onSuccess: async () => {
      setSethUnlocked(true);
      await me.refetch();
      setGate("open");
      toast("Seth Mode unlocked. Try not to rearrange anyone before breakfast.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isPending || gate === "boot") return <div className="h-40 animate-pulse rounded-[18px] bg-navy-2" />;
  if (!user) return <RedirectToSignIn />;

  if (gate !== "open") {
    return (
      <div className="mx-auto max-w-md space-y-5">
        <header className="text-center">
          <div className="mx-auto mb-4 grid size-14 place-items-center rounded-full border border-gold/40 bg-gold/10 text-gold">
            <Lock size={22} />
          </div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-gold">Young Gunz Command Center</p>
          <h1 className="font-display text-4xl">Seth Mode</h1>
          <p className="mt-2 text-sm text-muted">
            Anyone can open this. You do not have to be Seth. You do have to know the door code.
          </p>
        </header>
        <form
          className="panel space-y-3 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            unlock.mutate();
          }}
        >
          <Label>Door code</Label>
          <Input
            id="seth-code"
            type="password"
            autoComplete="off"
            inputMode="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Enter the code"
          />
          <Button className="w-full" type="submit" disabled={!code || unlock.isPending} size="xl">
            Unlock
          </Button>
        </form>
      </div>
    );
  }

  return <>{children}</>;
}
