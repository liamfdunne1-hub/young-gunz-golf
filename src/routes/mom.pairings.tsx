import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/mom/pairings")({
  beforeLoad: () => {
    throw redirect({ to: "/seth/pairings" });
  },
  component: () => null,
});
