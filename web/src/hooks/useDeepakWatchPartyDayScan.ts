import { fetchDeepakWatchPartyDayScan } from "../api/client";
import { useCancellableDayScan } from "./useCancellableDayScan";

export function useDeepakWatchPartyDayScan() {
  return useCancellableDayScan(fetchDeepakWatchPartyDayScan);
}
