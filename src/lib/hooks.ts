import { useQuery } from "@tanstack/react-query";
import { getBootstrap, getMe } from "@/lib/server/api";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { deriveStats, skinsBoard } from "@/lib/golf/derive";
import { deriveRecords } from "@/lib/golf/records";
import { deriveRoundTeams, deriveIntergroup } from "@/lib/golf/teams";

export function useTrip() {
  return useQuery({
    queryKey: ["trip"],
    queryFn: () => getBootstrap(),
    refetchInterval: 12_000,
  });
}

export function useMeQuery() {
  const { user, isPending } = useCurrentUserState();
  const q = useQuery({
    queryKey: ["me", user?.id],
    queryFn: () => getMe(),
    enabled: Boolean(user),
    retry: false,
  });
  return { ...q, authPending: isPending, authUser: user };
}

export function useStats() {
  const trip = useTrip();
  const skins = trip.data ? skinsBoard(trip.data) : null;
  const liveRound =
    trip.data?.rounds.find((r) => r.status === "live") ?? trip.data?.rounds.find((r) => r.status === "finalized");
  return {
    ...trip,
    stats: trip.data ? deriveStats(trip.data) : [],
    skins,
    records: trip.data && skins ? deriveRecords(trip.data, skins) : [],
    teams: trip.data ? deriveRoundTeams(trip.data) : [],
    intergroup: trip.data ? deriveIntergroup(trip.data, liveRound?.id ?? trip.data.rounds[0]?.id ?? 0) : [],
  };
}
