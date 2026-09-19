import { createRootRoute, HeadContent, Navigate, Outlet, Scripts, useRouterState } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { AuthProvider } from "@/lib/auth/provider";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { leaveGuestMode, useGuestMode } from "@/lib/guest";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { Providers } from "@/components/providers";
import { AppShell } from "@/components/layout/app-shell";
import { APP_NAME } from "@/lib/constants";
import appCss from "../styles.css?url";

const fetchSessionUser = createServerFn({ method: "GET" }).handler(async () => {
  const { getSessionUser } = await import("@/lib/auth/verify.server");
  const u = await getSessionUser();
  return u ? { id: u.id, email: u.email } : null;
});

export const Route = createRootRoute({
  beforeLoad: async () => ({ sessionUser: await fetchSessionUser() }),
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: APP_NAME },
      { name: "theme-color", content: "#0B1F33" },
      {
        name: "description",
        content: "Ten Golfers. Five Rounds. Zero Accountability. Young Gunz Orlando 2026.",
      },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  return (
    <html lang="en" className="antialiased" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="bg-navy text-cream">
        <PreviewHostBridge />
        <AuthProvider>
          <Providers>
            <ShellGate />
          </Providers>
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  );
}

function ShellGate() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { user, isPending } = useCurrentUserState();
  const guest = useGuestMode();
  const publicPath = path === "/login" || path.startsWith("/invite");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);
  useEffect(() => {
    if (user) leaveGuestMode();
  }, [user]);

  if (isPending || !ready) {
    return publicPath ? <Outlet /> : <div className="min-h-dvh bg-navy" />;
  }
  if (!user && !guest && !publicPath) return <Navigate to="/login" />;
  if (user && path === "/login") return <Navigate to="/" />;
  if (publicPath) return <Outlet />;
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
