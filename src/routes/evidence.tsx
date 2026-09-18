import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { addPhoto } from "@/lib/server/api";
import { useMeQuery, useTrip } from "@/lib/hooks";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export const Route = createFileRoute("/evidence")({ component: Evidence });

function Evidence() {
  const { data, isPending } = useTrip();
  const me = useMeQuery();
  const qc = useQueryClient();
  const [url, setUrl] = useState("");
  const [caption, setCaption] = useState("");
  const mut = useMutation({
    mutationFn: () => addPhoto({ data: { url, caption } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trip"] });
      setUrl("");
      setCaption("");
      toast("Entered into evidence.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  if (isPending || !data) return <div className="h-40 animate-pulse rounded-[18px] bg-navy-2" />;
  return (
    <div className="space-y-5">
      <header>
        <p className="text-[11px] uppercase tracking-[0.2em] text-gold">The Evidence</p>
        <h1 className="font-display text-4xl">Trip gallery</h1>
      </header>
      <div className="grid gap-3 sm:grid-cols-2">
        {data.photos.map((p) => (
          <figure key={p.id} className="overflow-hidden rounded-[18px] border border-line">
            <img src={p.url} alt={p.caption ?? ""} className="h-52 w-full object-cover" />
            {p.caption ? <figcaption className="p-3 text-sm text-muted">{p.caption}</figcaption> : null}
          </figure>
        ))}
      </div>
      {me.data?.player ? (
        <form
          className="panel space-y-3 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            mut.mutate();
          }}
        >
          <h2 className="font-display text-2xl">Submit evidence</h2>
          <div>
            <Label>Image URL</Label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} required placeholder="https://…" />
          </div>
          <div>
            <Label>Caption</Label>
            <Input value={caption} onChange={(e) => setCaption(e.target.value)} />
          </div>
          <Button type="submit" disabled={mut.isPending}>
            Upload
          </Button>
        </form>
      ) : null}
    </div>
  );
}
