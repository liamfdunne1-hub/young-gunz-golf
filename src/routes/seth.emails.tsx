import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getEmails, getMailSettings, saveMailSettings, sendBroadcast, sendTestEmail } from "@/lib/server/api";
import { clearMailKeys, clearPlaceholderPlayerEmails } from "@/lib/server/mail-admin";
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
      <p className="text-sm text-muted">
        Pairing notes, recaps, and reminders live here. Connect a free mail service below or they stay queued on the
        site until a key exists.
      </p>
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
      qc.invalidateQueries({ queryKey: ["emails"] });
      setApiKey("");
      setSmtpPass("");
      setXaiKey("");
      toast(
        res.connected
          ? `Connected. ${res.flushed ? `${res.flushed} queued emails went out.` : "Send a test below."}`
          : "Saved. Emails will stay queued until a key is added.",
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const strip = useMutation({
    mutationFn: () => clearPlaceholderPlayerEmails(),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["trip"] });
      qc.invalidateQueries({ queryKey: ["emails"] });
      toast(`Cleared ${res.players} fake addresses. Stopped ${res.emails} queued fakes.`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const clear = useMutation({
    mutationFn: () => clearMailKeys(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mail-settings"] });
      qc.invalidateQueries({ queryKey: ["emails"] });
      setApiKey("");
      setSmtpPass("");
      setXaiKey("");
      toast("Keys cleared. Emails will stay queued until you save a key again.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const test = useMutation({
    mutationFn: () => sendTestEmail({ data: { to: testTo.trim() } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["emails"] });
      toast("Test sent. Check that inbox, including spam.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="panel space-y-4 border-gold/30 p-4">
      <div>
        <p className="text-[11px] uppercase tracking-[0.18em] text-gold">Mail connection</p>
        <h2 className="font-display text-2xl">
          {settings?.connected ? "Connected" : "Not sending yet"}
        </h2>
        <p className="text-sm text-muted">
          {settings?.connected
            ? `${settings.provider === "smtp" ? "SMTP" : "Resend"} \u00b7 From ${settings.from}${settings.queued ? ` \u00b7 ${settings.queued} still queued` : ""}`
            : `${settings?.queued ?? 0} emails waiting. Paste a free Resend API key, or a Gmail app password.`}
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setProvider("resend")}
          className={`rounded-[12px] border px-3 py-3 text-left text-sm ${provider === "resend" ? "border-gold bg-gold/10" : "border-line"}`}
        >
          <span className="block font-medium text-cream">Resend (easiest)</span>
          <span className="text-xs text-muted">Free 100 emails/day. API key only.</span>
        </button>
        <button
          type="button"
          onClick={() => setProvider("smtp")}
          className={`rounded-[12px] border px-3 py-3 text-left text-sm ${provider === "smtp" ? "border-gold bg-gold/10" : "border-line"}`}
        >
          <span className="block font-medium text-cream">Gmail / SMTP</span>
          <span className="text-xs text-muted">App password. smtp.gmail.com:465.</span>
        </button>
      </div>
      <div>
        <Label>From</Label>
        <Input value={from} onChange={(e) => setFrom(e.target.value)} placeholder='Young Gunz <golf@yourdomain.com>' />
      </div>
      {provider === "resend" ? (
        <div>
          <Label>Resend API key {settings?.keyHint ? `(saved \u2026${settings.keyHint})` : ""}</Label>
          <Input
            type="password"
            autoComplete="off"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={settings?.hasKey ? "Leave blank to keep the saved key" : "re_\u2022\u2022\u2022\u2022"}
          />
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>SMTP host</Label>
              <Input value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} />
            </div>
            <div>
              <Label>Port</Label>
              <Input value={smtpPort} onChange={(e) => setSmtpPort(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Username</Label>
            <Input value={smtpUser} onChange={(e) => setSmtpUser(e.target.value)} autoComplete="off" />
          </div>
          <div>
            <Label>Password {settings?.hasSmtpPass ? "(saved)" : ""}</Label>
            <Input type="password" autoComplete="off" value={smtpPass} onChange={(e) => setSmtpPass(e.target.value)} />
          </div>
        </>
      )}
      <div>
        <Label>xAI key for recaps {settings?.aiHint ? `(saved \u2026${settings.aiHint})` : ""}</Label>
        <Input
          type="password"
          autoComplete="off"
          value={xaiKey}
          onChange={(e) => setXaiKey(e.target.value)}
          placeholder={settings?.hasAiKey ? "Leave blank to keep the saved key" : "xai-\u2022\u2022\u2022\u2022 from console.x.ai"}
        />
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button onClick={() => save.mutate()} disabled={save.isPending || !from.trim()}>
          {save.isPending ? "Saving\u2026" : "Save connection"}
        </Button>
        <Button
          type="button"
          variant="navy"
          disabled={clear.isPending}
          onClick={() => {
            if (!window.confirm("Clear Resend, SMTP, and xAI keys from this trip?")) return;
            clear.mutate();
          }}
        >
          {clear.isPending ? "Clearing\u2026" : "Clear API keys"}
        </Button>
        <Button
          type="button"
          variant="navy"
          disabled={strip.isPending}
          onClick={() => {
            if (!window.confirm("Remove fake @younggunz.golf addresses so tests stop bouncing?")) return;
            strip.mutate();
          }}
        >
          {strip.isPending ? "Stripping\u2026" : "Clear fake player emails"}
        </Button>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="you@email.com" />
        <Button variant="navy" onClick={() => test.mutate()} disabled={test.isPending || !testTo.trim()}>
          {test.isPending ? "Sending\u2026" : "Send test"}
        </Button>
      </div>
    </section>
  );
}
