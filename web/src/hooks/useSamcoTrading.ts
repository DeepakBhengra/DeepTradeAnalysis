import { useCallback, useEffect, useRef, useState } from "react";
import {
  downloadSamcoLogs,
  fetchSamcoLedger,
  fetchSamcoLogs,
  fetchSamcoOrders,
  fetchSamcoSettings,
  fetchSamcoStatus,
  refreshSamcoSession,
  setSamcoLiveTrading,
  updateSamcoSettings,
  type SamcoAuthStatus,
  type SamcoLedger,
  type SamcoOrdersResponse,
  type SamcoRuntimeSettings,
  type SamcoTradeLogRecord,
} from "../api/samco";
import {
  DEFAULT_SAMCO_RULE_VARIANT,
  isSamcoRuleVariant,
  type SamcoRuleVariant,
} from "../utils/samcoRuleVariant";

function todayIstDateKey(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function resolveRuleVariant(value: string | undefined): SamcoRuleVariant {
  return isSamcoRuleVariant(value) ? value : DEFAULT_SAMCO_RULE_VARIANT;
}

export function useSamcoTrading(isActive: boolean) {
  const [status, setStatus] = useState<SamcoAuthStatus | null>(null);
  const [settings, setSettings] = useState<SamcoRuntimeSettings | null>(null);
  const [ledger, setLedger] = useState<SamcoLedger | null>(null);
  const [orders, setOrders] = useState<SamcoOrdersResponse | null>(null);
  const [logs, setLogs] = useState<SamcoTradeLogRecord[]>([]);
  const [logDate, setLogDate] = useState(todayIstDateKey);
  const [quantityInput, setQuantityInput] = useState("100");
  const [minPriceInput, setMinPriceInput] = useState("0");
  const [maxPriceInput, setMaxPriceInput] = useState("3900");
  const [ruleVariantInput, setRuleVariantInput] = useState<SamcoRuleVariant>(
    DEFAULT_SAMCO_RULE_VARIANT,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const inputsDirtyRef = useRef(false);

  const syncInputsFromSettings = useCallback((nextSettings: SamcoRuntimeSettings) => {
    if (inputsDirtyRef.current) {
      return;
    }
    setQuantityInput(String(nextSettings.effectiveQuantity));
    setMinPriceInput(String(nextSettings.entryPriceMin));
    setMaxPriceInput(String(nextSettings.entryPriceMax));
    setRuleVariantInput(resolveRuleVariant(nextSettings.ruleVariant));
  }, []);

  const markInputsDirty = useCallback(() => {
    inputsDirtyRef.current = true;
  }, []);

  const clearInputsDirty = useCallback(() => {
    inputsDirtyRef.current = false;
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [nextStatus, nextSettings, nextLedger, nextOrders, nextLogs] =
        await Promise.all([
          fetchSamcoStatus(),
          fetchSamcoSettings(),
          fetchSamcoLedger(),
          fetchSamcoOrders(),
          fetchSamcoLogs(logDate),
        ]);
      setStatus(nextStatus);
      setSettings(nextSettings);
      setLedger(nextLedger);
      setOrders(nextOrders);
      setLogs(nextLogs.records);
      syncInputsFromSettings(nextSettings);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [logDate, syncInputsFromSettings]);

  useEffect(() => {
    if (!isActive) {
      inputsDirtyRef.current = false;
      return;
    }
    void refresh();
  }, [isActive, refresh]);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    const timer = window.setInterval(() => {
      void refresh();
    }, 5000);

    return () => window.clearInterval(timer);
  }, [isActive, refresh]);

  const setDryRun = useCallback(
    async (enabled: boolean, confirmLive = false) => {
      setActionError(null);
      const previous = settings;
      if (settings) {
        setSettings({ ...settings, dryRun: enabled });
      }

      try {
        const next = await updateSamcoSettings({ dryRun: enabled, confirmLive });
        setSettings(next);
        setStatus((current) =>
          current ? { ...current, dryRun: next.dryRun } : current,
        );
      } catch (err) {
        if (previous) {
          setSettings(previous);
        }
        const message = err instanceof Error ? err.message : String(err);
        setActionError(message);
        throw err;
      }
    },
    [settings],
  );

  const setLiveTrading = useCallback(
    async (enabled: boolean, confirmLive = false) => {
      setActionError(null);
      const previous = settings;
      if (settings) {
        setSettings({ ...settings, liveTradingEnabled: enabled });
      }

      try {
        const result = await setSamcoLiveTrading(enabled, confirmLive);
        setSettings((current) =>
          current
            ? { ...current, liveTradingEnabled: result.liveTradingEnabled }
            : current,
        );
        setStatus((current) =>
          current
            ? { ...current, liveTradingEnabled: result.liveTradingEnabled }
            : current,
        );
      } catch (err) {
        if (previous) {
          setSettings(previous);
        }
        const message = err instanceof Error ? err.message : String(err);
        setActionError(message);
        throw err;
      }
    },
    [settings],
  );

  const applyDayQuantity = useCallback(async () => {
    const quantity = Number(quantityInput);
    if (!Number.isInteger(quantity) || quantity < 1) {
      setActionError("Quantity must be a positive integer.");
      return;
    }

    setActionError(null);
    try {
      const next = await updateSamcoSettings({ quantity });
      setSettings(next);
      clearInputsDirty();
      setQuantityInput(String(next.effectiveQuantity));
      setMinPriceInput(String(next.entryPriceMin));
      setMaxPriceInput(String(next.entryPriceMax));
      setRuleVariantInput(resolveRuleVariant(next.ruleVariant));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setActionError(message);
      throw err;
    }
  }, [quantityInput, clearInputsDirty]);

  const applyEntryPriceRange = useCallback(async () => {
    const entryPriceMin = Number(minPriceInput);
    const entryPriceMax = Number(maxPriceInput);
    if (!Number.isFinite(entryPriceMin) || !Number.isFinite(entryPriceMax)) {
      setActionError("Entry price min and max must be valid numbers.");
      return;
    }

    setActionError(null);
    try {
      const next = await updateSamcoSettings({ entryPriceMin, entryPriceMax });
      setSettings(next);
      clearInputsDirty();
      setMinPriceInput(String(next.entryPriceMin));
      setMaxPriceInput(String(next.entryPriceMax));
      setQuantityInput(String(next.effectiveQuantity));
      setRuleVariantInput(resolveRuleVariant(next.ruleVariant));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setActionError(message);
      throw err;
    }
  }, [minPriceInput, maxPriceInput, clearInputsDirty]);

  const applyRuleVariant = useCallback(
    async (nextVariant: SamcoRuleVariant) => {
      setActionError(null);
      markInputsDirty();
      setRuleVariantInput(nextVariant);
      try {
        const next = await updateSamcoSettings({ ruleVariant: nextVariant });
        setSettings(next);
        clearInputsDirty();
        setRuleVariantInput(resolveRuleVariant(next.ruleVariant));
        setQuantityInput(String(next.effectiveQuantity));
        setMinPriceInput(String(next.entryPriceMin));
        setMaxPriceInput(String(next.entryPriceMax));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setActionError(message);
        throw err;
      }
    },
    [markInputsDirty, clearInputsDirty],
  );

  const applyTradingParams = useCallback(async () => {
    const quantity = Number(quantityInput);
    const entryPriceMin = Number(minPriceInput);
    const entryPriceMax = Number(maxPriceInput);
    if (!Number.isInteger(quantity) || quantity < 1) {
      setActionError("Quantity must be a positive integer.");
      return;
    }
    if (!Number.isFinite(entryPriceMin) || !Number.isFinite(entryPriceMax)) {
      setActionError("Entry price min and max must be valid numbers.");
      return;
    }

    setActionError(null);
    try {
      const next = await updateSamcoSettings({
        quantity,
        entryPriceMin,
        entryPriceMax,
        ruleVariant: ruleVariantInput,
      });
      setSettings(next);
      clearInputsDirty();
      setQuantityInput(String(next.effectiveQuantity));
      setMinPriceInput(String(next.entryPriceMin));
      setMaxPriceInput(String(next.entryPriceMax));
      setRuleVariantInput(resolveRuleVariant(next.ruleVariant));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setActionError(message);
      throw err;
    }
  }, [quantityInput, minPriceInput, maxPriceInput, ruleVariantInput, clearInputsDirty]);

  const refreshSession = useCallback(async () => {
    setActionError(null);
    try {
      await refreshSamcoSession();
      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setActionError(message);
      throw err;
    }
  }, [refresh]);

  const downloadLogs = useCallback(
    async (format: "csv" | "json") => {
      setActionError(null);
      try {
        await downloadSamcoLogs(logDate, format);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setActionError(message);
        throw err;
      }
    },
    [logDate],
  );

  const modeLabel =
    settings?.dryRun === false && settings?.liveTradingEnabled
      ? "LIVE"
      : "SIMULATED";

  return {
    status,
    settings,
    ledger,
    orders,
    logs,
    logDate,
    setLogDate,
    quantityInput,
    setQuantityInput: (value: string) => {
      markInputsDirty();
      setQuantityInput(value);
    },
    minPriceInput,
    setMinPriceInput: (value: string) => {
      markInputsDirty();
      setMinPriceInput(value);
    },
    maxPriceInput,
    setMaxPriceInput: (value: string) => {
      markInputsDirty();
      setMaxPriceInput(value);
    },
    ruleVariantInput,
    applyRuleVariant,
    loading,
    error,
    actionError,
    modeLabel,
    refresh,
    setDryRun,
    setLiveTrading,
    applyDayQuantity,
    applyEntryPriceRange,
    applyTradingParams,
    refreshSession,
    downloadLogs,
  };
}
