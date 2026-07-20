import { fetchDeepak2DayScan } from "../api/client";
import { useCancellableDayScan } from "./useCancellableDayScan";

export function useDeepak2DayScan() {
  return useCancellableDayScan(fetchDeepak2DayScan);
}
