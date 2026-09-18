import { createFileRoute, Outlet } from "@tanstack/react-router";
import { SethGate } from "@/components/seth-gate";

export const Route = createFileRoute("/seth")({
  component: SethLayout,
});

function SethLayout() {
  return (
    <SethGate>
      <Outlet />
    </SethGate>
  );
}
