import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { markRead } from "@/lib/server/api";
import { useMeQuery } from "@/lib/hooks";
import { Button } from "@/components/ui/button";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/notifications")({ component: Notes });

function Notes() {
  const { user, isPending } = useCurrentUserState();
  const me = useMeQuery();
  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: () => markRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["me"] }),
  });
  if (isPending) return null;
  if (!user) return <RedirectToSignIn />;
  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <h1 className="font-display text-4xl">Notifications</h1>
        <Button variant="navy" size="sm" onClick={() => mut.mutate()}>
          Mark read
        </Button>
      </div>
      {!me.data?.notifications.length ? (
        <p className="text-sm text-muted">Inbox empty. Seth will fix that.</p>
      ) : (
        <ul className="space-y-2">
          {me.data.notifications.map((n) => (
            <li key={n.id} className="panel p-4">
              <p className="text-[10px] uppercase tracking-[0.16em] text-gold">{n.type}</p>
              <p className="font-display text-xl">{n.title}</p>
              <p className="text-sm text-muted">{n.body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
