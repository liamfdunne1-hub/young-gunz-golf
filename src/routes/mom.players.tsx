import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/mom/players")({
  beforeLoad: () => {
    throw redirect({ to: "/seth/players" });
  },
  component: () => null,
});
