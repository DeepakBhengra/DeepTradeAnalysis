import { useCallback, useEffect, useState } from "react";

import { fetchSamcoSettings, updateSamcoSettings } from "../api/samco";
import {
  DEFAULT_DEEPPRO1_PROFIT_PCT,
  normalizeProfitPct,
} from "../utils/profitPct";

/**
 * Loads / saves the shared Samco `profitPct` used as Deeppro1 squareOffPct.
 */
export function useSamcoProfitPct(enabled = true) {
  const [profitPct, setProfitPctState] = useState(DEFAULT_DEEPPRO1_PROFIT_PCT);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const settings = await fetchSamcoSettings();
      setProfitPctState(normalizeProfitPct(settings.profitPct));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    void reload();
  }, [enabled, reload]);

  const setProfitPct = useCallback(async (next: number) => {
    const normalized = normalizeProfitPct(next);
    setProfitPctState(normalized);
    setSaving(true);
    setError(null);
    try {
      const settings = await updateSamcoSettings({ profitPct: normalized });
      setProfitPctState(normalizeProfitPct(settings.profitPct));
      return settings;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      throw err;
    } finally {
      setSaving(false);
    }
  }, []);

  return {
    profitPct,
    setProfitPct,
    loading,
    saving,
    error,
    reload,
  };
}
