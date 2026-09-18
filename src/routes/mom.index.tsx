import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/mom/")({
  beforeLoad: () => {
    throw redirect({ to: "/seth" });
  },
  component: () => null,
});
