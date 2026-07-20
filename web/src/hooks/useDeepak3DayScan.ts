import { fetchDeepak3DayScan } from "../api/client";
import { useCancellableDayScan } from "./useCancellableDayScan";

export function useDeepak3DayScan() {
  return useCancellableDayScan(fetchDeepak3DayScan);
}
