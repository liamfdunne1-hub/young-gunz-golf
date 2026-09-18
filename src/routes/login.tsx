import { useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { GROK_PROVIDERS, authClient, authEnabled, signIn } from "@/lib/auth/client";
import { Crest } from "@/components/crest";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { PRIMARY_TAGLINE } from "@/lib/constants";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onEmail(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "up") {
        const { error: err } = await authClient.signUp.email({ email, password, name, callbackURL: "/" });
        if (err) throw new Error(err.message);
      } else {
        const { error: err } = await authClient.signIn.email({ email, password, callbackURL: "/" });
        if (err) throw new Error(err.message);
      }
      window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative min-h-dvh overflow-hidden bg-navy">
      <img src="/images/hero.jpg" alt="" className="absolute inset-0 size-full object-cover opacity-40" />
      <div className="hero-scrim absolute inset-0" />
      <div className="relative mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
        <Link to="/" className="mb-8 flex flex-col items-center text-center">
          <Crest className="h-20 w-20" />
          <p className="mt-4 text-[11px] uppercase tracking-[0.32em] text-gold">Private Society</p>
          <h1 className="font-display text-4xl text-cream">Young Gunz</h1>
          <p className="text-sm text-cream/70">{PRIMARY_TAGLINE}</p>
        </Link>
        <div className="panel p-5">
          <h2 className="font-display text-2xl">Sign in</h2>
          <p className="mb-4 text-sm text-muted">
            Google, X, or email. If this preview already signed you in as Grok User, skip this page and{" "}
            <Link to="/locker" className="text-gold hover:underline">
              claim a bag in the locker room
            </Link>
            .
          </p>
          {authEnabled ? (
            <div className="space-y-2">
              {GROK_PROVIDERS.map((p) => (
                <Button
                  key={p.providerId}
                  type="button"
                  variant="navy"
                  className="w-full"
                  onClick={() => signIn(p.providerId, { callbackURL: "/" })}
                >
                  Continue with {p.label}
                </Button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">Sign-in is disabled.</p>
          )}
          <div className="gold-rule my-5" />
          <form onSubmit={onEmail} className="space-y-3">
            {mode === "up" ? (
              <div>
                <Label>Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
            ) : null}
            <div>
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <Label>Password</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
            </div>
            {error ? <p className="text-sm text-orange">{error}</p> : null}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Working…" : mode === "up" ? "Create account" : "Sign in with email"}
            </Button>
          </form>
          <button
            type="button"
            className="mt-3 w-full text-center text-xs text-muted hover:text-gold"
            onClick={() => setMode(mode === "up" ? "in" : "up")}
          >
            {mode === "up" ? "Already summoned? Sign in" : "Need an account? Create one"}
          </button>
        </div>
      </div>
    </main>
  );
}
