import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/mom/emails")({
  beforeLoad: () => {
    throw redirect({ to: "/seth/emails" });
  },
  component: () => null,
});
