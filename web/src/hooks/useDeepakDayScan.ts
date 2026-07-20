import { fetchDeepakDayScan } from "../api/client";
import { useCancellableDayScan } from "./useCancellableDayScan";

export function useDeepakDayScan() {
  return useCancellableDayScan(fetchDeepakDayScan);
}
