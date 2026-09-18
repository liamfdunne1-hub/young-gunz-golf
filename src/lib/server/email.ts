import type { Sql } from "@/lib/db";
import { sendSmtpEmail } from "@/lib/server/smtp";

export type MailProvider = "none" | "resend" | "smtp";

export type MailConfig = {
  provider: MailProvider;
  apiKey: string | null;
  from: string;
  smtpHost: string | null;
  smtpPort: number;
  smtpUser: string | null;
  smtpPass: string | null;
  xaiKey: string | null;
};

const DEFAULT_FROM = "Young Gunz <beth.t@example.com>";

export async function loadMailConfig(sql: Sql): Promise<MailConfig> {
  let row: {
    email_provider: string | null;
    email_api_key: string | null;
    email_from: string | null;
    smtp_host: string | null;
    smtp_port: number | null;
    smtp_user: string | null;
    smtp_pass: string | null;
    xai_api_key: string | null;
  } | undefined;
  try {
    [row] = await sql<NonNullable<typeof row>>`
      select email_provider, email_api_key, email_from, smtp_host, smtp_port, smtp_user, smtp_pass, xai_api_key
      from trips order by id limit 1
    `;
  } catch {
    row = undefined;
  }
  const envKey = process.env.RESEND_API_KEY?.trim() || null;
  const envFrom = process.env.RESEND_FROM?.trim() || process.env.EMAIL_FROM?.trim() || null;
  const provider = (row?.email_provider as MailProvider) || (envKey ? "resend" : "none");
  return {
    provider: provider === "none" && envKey ? "resend" : provider,
    apiKey: row?.email_api_key?.trim() || envKey,
    from: row?.email_from?.trim() || envFrom || DEFAULT_FROM,
    smtpHost: row?.smtp_host?.trim() || null,
    smtpPort: row?.smtp_port || 465,
    smtpUser: row?.smtp_user?.trim() || null,
    smtpPass: row?.smtp_pass ?? null,
    xaiKey: row?.xai_api_key?.trim() || process.env.XAI_API_KEY?.trim() || null,
  };
}

export function mailStatus(cfg: MailConfig) {
  const hint = (value: string | null) => {
    const v = value?.trim() ?? "";
    if (v.length < 4) return "";
    return v.slice(-4);
  };
  const connected =
    (cfg.provider === "resend" && Boolean(cfg.apiKey)) ||
    (cfg.provider === "smtp" && Boolean(cfg.smtpHost && cfg.smtpUser && cfg.smtpPass));
  return {
    provider: cfg.provider,
    from: cfg.from,
    connected,
    hasKey: Boolean(cfg.apiKey),
    keyHint: hint(cfg.apiKey),
    smtpHost: cfg.smtpHost ?? "",
    smtpPort: cfg.smtpPort,
    smtpUser: cfg.smtpUser ?? "",
    hasSmtpPass: Boolean(cfg.smtpPass),
    hasAiKey: Boolean(cfg.xaiKey),
    aiHint: hint(cfg.xaiKey),
  };
}

async function deliverResend(cfg: MailConfig, to: string, subject: string, html: string): Promise<"sent" | "queued"> {
  const key = cfg.apiKey;
  if (!key) return "queued";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: cfg.from, to, subject, html }),
  });
  if (!res.ok) return "queued";
  return "sent";
}

async function deliverNow(cfg: MailConfig, to: string, subject: string, html: string): Promise<"sent" | "queued"> {
  if (cfg.provider === "resend") return deliverResend(cfg, to, subject, html);
  if (cfg.provider === "smtp") {
    if (!cfg.smtpHost || !cfg.smtpUser || !cfg.smtpPass) return "queued";
    try {
      await sendSmtpEmail(
        {
          host: cfg.smtpHost,
          port: cfg.smtpPort,
          user: cfg.smtpUser,
          pass: cfg.smtpPass,
          from: cfg.from,
        },
        to,
        subject,
        html,
      );
      return "sent";
    } catch {
      return "queued";
    }
  }
  return "queued";
}

function wrapHtml(title: string, body: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;background:#0B1F33;color:#F4EFE4;font-family:Georgia,serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0B1F33;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="max-width:560px;width:100%;">
          <tr>
            <td style="padding:12px 0 24px;text-align:center;letter-spacing:0.28em;font-size:11px;color:#C4A35A;text-transform:uppercase;">
              Young Gunz · Orlando 2026
            </td>
          </tr>
          <tr>
            <td style="border:1px solid rgba(196,163,90,0.35);background:#12283F;padding:32px 28px;">
              <div style="font-size:28px;line-height:1.15;color:#F4EFE4;margin-bottom:16px;">${escapeHtml(title)}</div>
              <div style="font-size:16px;line-height:1.6;color:#E7DFCF;">${body}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 8px 0;text-align:center;font-size:12px;color:#8A96A3;line-height:1.5;">
              Complaints may be submitted directly to Commissioner Young and immediately disregarded.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function inviteEmailHtml(claimUrl: string): string {
  return wrapHtml(
    "You Have Been Summoned",
    `<p>You’re officially invited to:</p>
     <p style="font-size:22px;margin:12px 0;">YOUNG GUNZ<br/>ORLANDO 2026</p>
     <p>Ten Golfers. Five Rounds. One Extremely Involved Seth Young.</p>
     <p style="margin:28px 0;">
       <a href="${claimUrl}" style="display:inline-block;background:#C4A35A;color:#0B1F33;text-decoration:none;padding:12px 22px;font-family:Arial,sans-serif;letter-spacing:0.08em;font-size:13px;">CLAIM MY SPOT</a>
     </p>
     <p style="font-size:14px;color:#C4A35A;">Please register promptly so Seth doesn’t have to follow up with you individually like your mother.</p>`,
  );
}

export function pairingEmailHtml(args: {
  roundName: string;
  course: string;
  teeTime: string;
  group: string[];
  match?: string;
  url: string;
}): string {
  return wrapHtml(
    "The Pairings Are In.",
    `<p><strong>${escapeHtml(args.roundName)}</strong><br/>${escapeHtml(args.course)} · ${escapeHtml(args.teeTime)}</p>
     <p>YOUR GROUP:</p>
     <p>${args.group.map(escapeHtml).join("<br/>")}</p>
     ${args.match ? `<p>YOUR MATCH:<br/>${escapeHtml(args.match)}</p>` : "<p>YOUR MATCH:<br/>Waiting for Seth to rearrange everyone for the 14th time.</p>"}
     <p style="margin:28px 0;">
       <a href="${args.url}" style="display:inline-block;background:#C4A35A;color:#0B1F33;text-decoration:none;padding:12px 22px;font-family:Arial,sans-serif;">VIEW MATCH</a>
     </p>`,
  );
}

export function reminderEmailHtml(name: string, task: string, url: string): string {
  return wrapHtml(
    "Seth Needs Something From You",
    `<p>Hello ${escapeHtml(name)},</p>
     <p>This is an automated message because Seth has reached the point where he has built software to avoid personally reminding grown men to complete basic tasks.</p>
     <p>${escapeHtml(task)}</p>
     <p style="margin:28px 0;">
       <a href="${url}" style="display:inline-block;background:#C4A35A;color:#0B1F33;text-decoration:none;padding:12px 22px;font-family:Arial,sans-serif;">UPDATE NOW</a>
     </p>
     <p>— Young Gunz Automated Maternal Services</p>`,
  );
}

export async function queueEmail(
  sql: Sql,
  args: {
    tripId: number;
    toEmail: string;
    toPlayerId?: number | null;
    subject: string;
    html: string;
    type: string;
    roundId?: number | null;
    scheduledAt?: string | null;
  },
) {
  const sendNow = !args.scheduledAt;
  let status: string = args.scheduledAt ? "scheduled" : "queued";
  let sentAt: string | null = null;
  if (sendNow) {
    const cfg = await loadMailConfig(sql);
    status = await deliverNow(cfg, args.toEmail, args.subject, args.html);
    if (status === "sent") sentAt = new Date().toISOString();
  }
  const [row] = await sql<{ id: number }>`
    insert into emails (
      trip_id, to_player_id, to_email, subject, html, type, status, scheduled_at, sent_at, related_round_id
    ) values (
      ${args.tripId}, ${args.toPlayerId ?? null}, ${args.toEmail}, ${args.subject}, ${args.html},
      ${args.type}, ${status}, ${args.scheduledAt ?? null}, ${sentAt}, ${args.roundId ?? null}
    )
    returning id
  `;
  return { id: row.id, status };
}

export async function flushQueuedEmails(sql: Sql): Promise<{ sent: number; leftover: number }> {
  const cfg = await loadMailConfig(sql);
  const rows = await sql<{
    id: number;
    to_email: string;
    subject: string;
    html: string;
  }>`
    select id, to_email, subject, html from emails
    where status in ('queued', 'failed')
    order by id
    limit 80
  `;
  let sent = 0;
  for (const row of rows) {
    const status = await deliverNow(cfg, row.to_email, row.subject, row.html);
    if (status === "sent") {
      sent += 1;
      await sql`update emails set status = 'sent', sent_at = now() where id = ${row.id}`;
    }
  }
  return { sent, leftover: rows.length - sent };
}

export async function sendOneEmail(sql: Sql, to: string, subject: string, html: string): Promise<"sent" | "queued"> {
  const cfg = await loadMailConfig(sql);
  return deliverNow(cfg, to, subject, html);
}

export { wrapHtml };

export async function maybeQueueReminders(sql: Sql) {
  const [trip] = await sql<{ id: number; start_date: string }>`select id, start_date from trips limit 1`;
  if (!trip) return;
  const start = new Date(`${trip.start_date}T18:00:00-05:00`).getTime();
  const days = (start - Date.now()) / 86_400_000;
  const waves = [
    {
      type: "d30",
      min: 29,
      max: 31,
      subject: "30 Days Until the Young Gunz Invade Orlando",
      title: "30 days.",
      body: "The itinerary is on the website. The courses are on the website. The tee times are on the website. Seth has already answered this.",
    },
    {
      type: "d7",
      min: 6,
      max: 8,
      subject: "One Week. Start Stretching.",
      title: "One week.",
      body: "Pack sunscreen. Charge your phone. Do not ask Seth what time the first tee time is. It is 9:00 AM at Waldorf Astoria, unless you are asking about Friday, in which case it is 6:50 AM. Yes. 6:50 AM.",
    },
    {
      type: "d1",
      min: 0,
      max: 1.2,
      subject: "Tomorrow We Ride.",
      title: "Tomorrow we ride.",
      body: "Update your flight if you have not. Be downstairs when the itinerary says downstairs. Seth has been awake for some time and is becoming concerned about you.",
    },
  ];
  for (const wave of waves) {
    if (days < wave.min || days > wave.max) continue;
    const existing = await sql<{ n: number }>`select count(*)::int as n from emails where type = ${wave.type}`;
    if ((existing[0]?.n ?? 0) > 0) continue;
    const players = await sql<{ id: number; email: string }>`select id, email from players`;
    for (const p of players) {
      await queueEmail(sql, {
        tripId: trip.id,
        toEmail: p.email,
        toPlayerId: p.id,
        subject: wave.subject,
        html: wrapHtml(wave.title, `<p>${wave.body}</p>`),
        type: wave.type,
      });
    }
  }
}
