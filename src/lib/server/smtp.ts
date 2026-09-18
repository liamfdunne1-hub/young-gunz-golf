import { connect } from "node:tls";

export type SmtpConfig = {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
};

function encodeAuth(user: string, pass: string) {
  return Buffer.from(`\0${user}\0${pass}`).toString("base64");
}

function sendCommand(socket: { write: (s: string) => void }, line: string) {
  socket.write(`${line}\r\n`);
}

export function sendSmtpEmail(
  cfg: SmtpConfig,
  to: string,
  subject: string,
  html: string,
): Promise<void> {
  const port = cfg.port || 465;
  const boundary = `yg${Date.now().toString(16)}`;
  const payload = [
    `From: ${cfg.from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/html; charset=utf-8",
    "",
    html,
    `--${boundary}--`,
    "",
  ].join("\r\n");

  return new Promise((resolve, reject) => {
    const socket = connect(
      { host: cfg.host, port, servername: cfg.host, timeout: 20000 },
      () => undefined,
    );
    let buf = "";
    let step: "banner" | "ehlo" | "auth" | "from" | "to" | "data" | "body" | "quit" = "banner";
    const fail = (err: Error) => {
      socket.destroy();
      reject(err);
    };
    socket.setEncoding("utf8");
    socket.on("timeout", () => fail(new Error("Mail server timed out.")));
    socket.on("error", fail);
    socket.on("data", (chunk: string) => {
      buf += chunk;
      if (!buf.includes("\n")) return;
      const lines = buf.split(/\r?\n/);
      const last = lines.filter(Boolean).at(-1) ?? "";
      const code = Number(last.slice(0, 3));
      if (last.startsWith("250-")) return;
      buf = "";
      if (step === "banner") {
        if (code !== 220) return fail(new Error(last || "No SMTP banner"));
        step = "ehlo";
        sendCommand(socket, "EHLO younggunz.golf");
        return;
      }
      if (step === "ehlo") {
        if (code !== 250) return fail(new Error(last || "EHLO failed"));
        step = "auth";
        sendCommand(socket, `AUTH PLAIN ${encodeAuth(cfg.user, cfg.pass)}`);
        return;
      }
      if (step === "auth") {
        if (code !== 235) return fail(new Error("Mail login failed. Check the username and app password."));
        step = "from";
        const fromAddr = cfg.from.match(/<([^>]+)>/)?.[1] ?? cfg.from;
        sendCommand(socket, `MAIL FROM:<${fromAddr}>`);
        return;
      }
      if (step === "from") {
        if (code !== 250) return fail(new Error(last || "MAIL FROM rejected"));
        step = "to";
        sendCommand(socket, `RCPT TO:<${to}>`);
        return;
      }
      if (step === "to") {
        if (code !== 250 && code !== 251) return fail(new Error(last || "Recipient rejected"));
        step = "data";
        sendCommand(socket, "DATA");
        return;
      }
      if (step === "data") {
        if (code !== 354) return fail(new Error(last || "DATA rejected"));
        step = "body";
        socket.write(`${payload.replace(/^\./gm, "..")}\r\n.\r\n`);
        return;
      }
      if (step === "body") {
        if (code !== 250) return fail(new Error(last || "Message rejected"));
        step = "quit";
        sendCommand(socket, "QUIT");
        socket.end();
        resolve();
      }
    });
  });
}
