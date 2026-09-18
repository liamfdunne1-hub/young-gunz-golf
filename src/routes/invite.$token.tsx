import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { claimInvite } from "@/lib/server/api";
import { Crest } from "@/components/crest";
import { Button } from "@/components/ui/button";
import { SignInGate } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/invite/$token")({ component: Invite });

function Invite() {
  const { token } = Route.useParams();
  const { isPending } = useCurrentUserState();
  const mut = useMutation({
    mutationFn: () => claimInvite({ data: { token } }),
    onSuccess: () => toast("Spot claimed. Try not to ask Seth what time the tee time is."),
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <main className="relative grid min-h-dvh place-items-center bg-navy px-5">
      <img src="/images/hero.jpg" alt="" className="absolute inset-0 size-full object-cover opacity-30" />
      <div className="hero-scrim absolute inset-0" />
      <div className="panel relative max-w-md p-6 text-center">
        <Crest className="mx-auto h-16 w-16" />
        <h1 className="mt-3 font-display text-3xl">You Have Been Summoned</h1>
        <p className="mt-2 text-sm text-muted">
          Young Gunz · Orlando 2026. Ten golfers. Five rounds. One extremely involved Seth Young.
        </p>
        {isPending ? <p className="mt-4 text-sm">Checking your papers…</p> : null}
        <SignInGate
          fallback={
            <Link to="/login" className="mt-4 inline-flex h-11 items-center rounded-[12px] bg-gold px-4 text-sm text-navy">
              Sign in to claim your spot
            </Link>
          }
        >
          <Button className="mt-4 w-full" onClick={() => mut.mutate()} disabled={mut.isPending}>
            Claim my spot
          </Button>
        </SignInGate>
        {mut.isSuccess ? (
          <Link to="/" className="mt-3 block text-sm text-gold">
            Enter the club
          </Link>
        ) : null}
      </div>
    </main>
  );
}
