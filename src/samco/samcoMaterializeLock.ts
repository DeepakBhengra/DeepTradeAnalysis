/**
 * Serialize Day Scan / poll materialize so overlapping pushes (live rescan,
 * React double-effect, poll + push) cannot both pass a missing-ledger check
 * and place the same entry twice.
 */
let materializeChain: Promise<unknown> = Promise.resolve();

export async function withSamcoMaterializeLock<T>(
  fn: () => Promise<T>,
): Promise<T> {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const previous = materializeChain;
  materializeChain = previous.then(
    () => gate,
    () => gate,
  );

  await previous.catch(() => undefined);
  try {
    return await fn();
  } finally {
    release();
  }
}

/** Test helper — reset the lock chain between cases. */
export function resetSamcoMaterializeLock(): void {
  materializeChain = Promise.resolve();
}
