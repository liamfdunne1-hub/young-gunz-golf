import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getEmails, getMailSettings, saveMailSettings, sendBroadcast, sendTestEmail } from "@/lib/server/api";
import { clearMailKeys, clearPlaceholderPlayerEmails } from "@/lib/server/mail-admin";
import { generateTestRecap } from "@/lib/server/recap-fn";
import { useMeQuery } from "@/lib/hooks";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/seth/emails")({ component: SethEmails });

function SethEmails() {
  const { user, isPending } = useCurrentUserState();
  const me = useMeQuery();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["emails"],
    queryFn: () => getEmails(),
    enabled: Boolean(me.data?.isAdmin),
  });
  const mail = useQuery({
    queryKey: ["mail-settings"],
    queryFn: () => getMailSettings(),
    enabled: Boolean(me.data?.isAdmin),
  });
  const [subject, setSubject] = useState("From the Commissioner");
  const [body, setBody] = useState("Please check the itinerary before asking Seth.");
  const send = useMutation({
    mutationFn: () => sendBroadcast({ data: { subject, body } }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["emails"] });
      qc.invalidateQueries({ queryKey: ["mail-settings"] });
      toast(`Queued for ${res.count} golfers.`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  if (isPending) return null;
  if (!user) return <RedirectToSignIn />;
  if (me.isFetched && !me.data?.isAdmin) return <p>Enter Seth Mode first. The door code is the key, not the bag.</p>;
  return (
    <div className="space-y-4">
      <h1 className="font-display text-4xl">Email center</h1>
      <MailHook settings={mail.data} />
      <div className="panel space-y-3 p-4">
        <div>
          <Label>Subject</Label>
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
        </div>
        <div>
          <Label>Body</Label>
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} />
        </div>
        <Button onClick={() => send.mutate()} disabled={send.isPending}>
          Email everyone
        </Button>
      </div>
      <ul className="space-y-2">
        {(q.data ?? []).map((e) => (
          <li key={e.id} className="panel p-4">
            <div className="flex justify-between gap-3 text-xs text-gold">
              <span>{e.type}</span>
              <span className="uppercase">{e.status}</span>
            </div>
            <p className="font-display text-xl">{e.subject}</p>
            <p className="text-sm text-muted">{e.to_email}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MailHook({
  settings,
}: {
  settings?: {
    provider: "none" | "resend" | "smtp";
    from: string;
    connected: boolean;
    hasKey: boolean;
    keyHint: string;
    smtpHost: string;
    smtpPort: number;
    smtpUser: string;
    hasSmtpPass: boolean;
    hasAiKey: boolean;
    aiHint: string;
    queued: number;
  };
}) {
  const qc = useQueryClient();
  const me = useMeQuery();
  const [provider, setProvider] = useState<"none" | "resend" | "smtp">("resend");
  const [from, setFrom] = useState("Young Gunz <golf@yourdomain.com>");
  const [apiKey, setApiKey] = useState("");
  const [smtpHost, setSmtpHost] = useState("smtp.gmail.com");
  const [smtpPort, setSmtpPort] = useState("465");
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [xaiKey, setXaiKey] = useState("");
  const [testTo, setTestTo] = useState(me.data?.email ?? "");
  const [preview, setPreview] = useState<{ title: string; body: string; quote: string; usedAi: boolean; note?: string } | null>(null);

  useEffect(() => {
    if (!settings) return;
    setProvider(settings.provider === "none" ? "resend" : settings.provider);
    if (settings.from) setFrom(settings.from);
    if (settings.smtpHost) setSmtpHost(settings.smtpHost);
    if (settings.smtpPort) setSmtpPort(String(settings.smtpPort));
    if (settings.smtpUser) setSmtpUser(settings.smtpUser);
    if (me.data?.email) setTestTo(me.data.email);
  }, [settings, me.data?.email]);

  const save = useMutation({
    mutationFn: () =>
      saveMailSettings({
        data: {
          provider,
          from,
          apiKey: apiKey.trim() || undefined,
          smtpHost,
          smtpPort: Number(smtpPort) || 465,
          smtpUser,
          smtpPass: smtpPass.trim() || undefined,
          xaiKey: xaiKey.trim() || undefined,
        },
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["mail-settings"] });
      setApiKey("");
      setSmtpPass("");
      setXaiKey("");
      toast(res.connected ? "Connected." : "Saved.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const strip = useMutation({
    mutationFn: () => clearPlaceholderPlayerEmails(),
    onSuccess: (res) => toast(`Cleared ${res.players} fake addresses.`),
    onError: (e: Error) => toast.error(e.message),
  });

  const clear = useMutation({
    mutationFn: () => clearMailKeys(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mail-settings"] });
      toast("Keys cleared.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const test = useMutation({
    mutationFn: () => sendTestEmail({ data: { to: testTo.trim() } }),
    onSuccess: () => toast("Test sent. Check that inbox, including spam."),
    onError: (e: Error) => toast.error(e.message),
  });

  const xai = useMutation({
    mutationFn: () => generateTestRecap({ data: { to: testTo.trim() || undefined } }),
    onSuccess: (res) => {
      setPreview(res);
      toast(
        res.usedAi
          ? res.emailed
            ? "Grok wrote a fake recap and emailed it to the test address."
            : "Grok wrote a fake recap. It is on screen, not in the field inbox."
          : res.note ?? "Template wrote the fake recap.",
      );
      qc.invalidateQueries({ queryKey: ["emails"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="panel space-y-4 border-gold/30 p-4">
      <div>
        <p className="text-[11px] uppercase tracking-[0.18em] text-gold">Mail connection</p>
        <h2 className="font-display text-2xl">{settings?.connected ? "Connected" : "Not sending yet"}</h2>
      </div>
      <div>
        <Label>From</Label>
        <Input value={from} onChange={(e) => setFrom(e.target.value)} />
      </div>
      {provider === "resend" ? (
        <div>
          <Label>Resend API key {settings?.keyHint ? `(saved)` : ""}</Label>
          <Input type="password" autoComplete="off" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
        </div>
      ) : null}
      <div>
        <Label>xAI key for recaps {settings?.hasAiKey ? "(saved)" : ""}</Label>
        <Input type="password" autoComplete="off" value={xaiKey} onChange={(e) => setXaiKey(e.target.value)} />
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button onClick={() => save.mutate()} disabled={save.isPending || !from.trim()}>
          Save connection
        </Button>
        <Button type="button" variant="navy" disabled={clear.isPending} onClick={() => clear.mutate()}>
          Clear API keys
        </Button>
        <Button type="button" variant="navy" disabled={strip.isPending} onClick={() => strip.mutate()}>
          Clear fake player emails
        </Button>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Input type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="you@email.com" />
        <Button variant="navy" onClick={() => test.mutate()} disabled={test.isPending || !testTo.trim()}>
          Send test
        </Button>
        <Button type="button" variant="gold" onClick={() => xai.mutate()} disabled={xai.isPending}>
          {xai.isPending ? "Grok is inventing golf…" : "xAI recap test"}
        </Button>
      </div>
      <p className="text-xs text-muted">
        xAI recap test invents 18 holes for everyone, does not save those scores, and only emails the address in the box.
      </p>
      {preview ? (
        <div className="rounded-[12px] border border-gold/30 p-3">
          <p className="text-xs text-gold">{preview.usedAi ? "Grok" : "Template"}{preview.note ? ` · ${preview.note}` : ""}</p>
          <p className="font-display text-2xl">{preview.title}</p>
          <p className="mt-2 whitespace-pre-wrap text-sm">{preview.body}</p>
          {preview.quote ? <p className="mt-2 text-sm italic text-gold">{preview.quote}</p> : null}
        </div>
      ) : null}
    </section>
  );
}
