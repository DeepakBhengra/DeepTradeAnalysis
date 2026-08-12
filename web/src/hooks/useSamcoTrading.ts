import { useCallback, useEffect, useRef, useState } from "react";
import {
  downloadSamcoLogs,
  fetchSamcoLedger,
  fetchSamcoLogs,
  fetchSamcoOrders,
  fetchSamcoSettings,
  fetchSamcoStatus,
  refreshSamcoSession,
  runSamcoTradingCycle,
  setSamcoLiveTrading,
  squareOffSamcoLedgerEntry,
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
  const [stopLossPctInput, setStopLossPctInput] = useState("");
  const [ruleVariantInput, setRuleVariantInput] = useState<SamcoRuleVariant>(
    DEFAULT_SAMCO_RULE_VARIANT,
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [refreshInfo, setRefreshInfo] = useState<string | null>(null);
  const inputsDirtyRef = useRef(false);

  const syncInputsFromSettings = useCallback((nextSettings: SamcoRuntimeSettings) => {
    if (inputsDirtyRef.current) {
      return;
    }
    setQuantityInput(String(nextSettings.effectiveQuantity));
    setMinPriceInput(String(nextSettings.entryPriceMin));
    setMaxPriceInput(String(nextSettings.entryPriceMax));
    setStopLossPctInput(
      nextSettings.stopLossPct == null ? "" : String(nextSettings.stopLossPct),
    );
    setRuleVariantInput(resolveRuleVariant(nextSettings.ruleVariant));
  }, []);

  const markInputsDirty = useCallback(() => {
    inputsDirtyRef.current = true;
  }, []);

  const clearInputsDirty = useCallback(() => {
    inputsDirtyRef.current = false;
  }, []);

  const loadSnapshot = useCallback(async () => {
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
    return nextOrders;
  }, [logDate, syncInputsFromSettings]);

  const refresh = useCallback(
    async (options?: { runCycle?: boolean; silent?: boolean }) => {
      const runCycle = options?.runCycle === true;
      const silent = options?.silent === true;
      if (!silent) {
        setRefreshing(true);
        setRefreshInfo(null);
        // Clear panels immediately so previous open/executed/rejected + trade logs disappear.
        setOrders({
          open: [],
          executed: [],
          rejected: [],
          updatedAt: new Date().toISOString(),
          signalSource: {
            date: null,
            variant: null,
            tradeCount: 0,
            runAt: null,
          },
        });
        setLogs([]);
        setLedger({
          version: 1,
          updatedAt: new Date().toISOString(),
          entries: [],
        });
      }
      try {
        if (runCycle) {
          const cycleResult = await runSamcoTradingCycle({
            clearPrevious: !silent,
            logDate,
          });
          setStatus(cycleResult.status);
          setOrders(cycleResult.orders);
          setLogs(cycleResult.logs?.records ?? []);
          const [nextSettings, nextLedger] = await Promise.all([
            fetchSamcoSettings(),
            fetchSamcoLedger(),
          ]);
          setSettings(nextSettings);
          setLedger(nextLedger);
          syncInputsFromSettings(nextSettings);
          if (!silent) {
            setRefreshInfo(
              cycleResult.cleared
                ? "Cleared open / executed / rejected orders and trade logs. Run Day Scan again to refill."
                : `Orders refreshed · executed ${cycleResult.orders.executed.length} · open ${cycleResult.orders.open.length} · rejected ${cycleResult.orders.rejected.length}` +
                    (cycleResult.cycle.processed
                      ? ` · cycle +${cycleResult.cycle.entriesPlaced} entry / +${cycleResult.cycle.exitsPlaced} exit (${cycleResult.cycle.signalSource})`
                      : ""),
            );
          }
        } else {
          const nextOrders = await loadSnapshot();
          if (!silent) {
            setRefreshInfo(
              `Orders refreshed · executed ${nextOrders.executed.length} · open ${nextOrders.open.length} · rejected ${nextOrders.rejected.length}`,
            );
          }
        }
        setError(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
      } finally {
        setLoading(false);
        if (!silent) {
          setRefreshing(false);
        }
      }
    },
    [loadSnapshot, logDate, syncInputsFromSettings],
  );

  useEffect(() => {
    if (!isActive) {
      inputsDirtyRef.current = false;
      return;
    }
    void refresh({ silent: true });
  }, [isActive, refresh]);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    const timer = window.setInterval(() => {
      void refresh({ silent: true });
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
      setStopLossPctInput(
        next.stopLossPct == null ? "" : String(next.stopLossPct),
      );
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
      setStopLossPctInput(
        next.stopLossPct == null ? "" : String(next.stopLossPct),
      );
      setRuleVariantInput(resolveRuleVariant(next.ruleVariant));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setActionError(message);
      throw err;
    }
  }, [minPriceInput, maxPriceInput, clearInputsDirty]);

  const applyStopLossPct = useCallback(async () => {
    const raw = stopLossPctInput.trim();
    const stopLossPct = raw === "" || raw === "0" ? null : Number(raw);
    if (stopLossPct != null && (!Number.isFinite(stopLossPct) || stopLossPct < 0)) {
      setActionError("Stop-loss % must be blank, 0 (off), or a positive number.");
      return;
    }

    setActionError(null);
    try {
      const next = await updateSamcoSettings({ stopLossPct });
      setSettings(next);
      clearInputsDirty();
      setStopLossPctInput(
        next.stopLossPct == null ? "" : String(next.stopLossPct),
      );
      setQuantityInput(String(next.effectiveQuantity));
      setMinPriceInput(String(next.entryPriceMin));
      setMaxPriceInput(String(next.entryPriceMax));
      setRuleVariantInput(resolveRuleVariant(next.ruleVariant));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setActionError(message);
      throw err;
    }
  }, [stopLossPctInput, clearInputsDirty]);

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
        setStopLossPctInput(
          next.stopLossPct == null ? "" : String(next.stopLossPct),
        );
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
    const stopLossRaw = stopLossPctInput.trim();
    const stopLossPct =
      stopLossRaw === "" || stopLossRaw === "0" ? null : Number(stopLossRaw);
    if (!Number.isInteger(quantity) || quantity < 1) {
      setActionError("Quantity must be a positive integer.");
      return;
    }
    if (!Number.isFinite(entryPriceMin) || !Number.isFinite(entryPriceMax)) {
      setActionError("Entry price min and max must be valid numbers.");
      return;
    }
    if (stopLossPct != null && (!Number.isFinite(stopLossPct) || stopLossPct < 0)) {
      setActionError("Stop-loss % must be blank, 0 (off), or a positive number.");
      return;
    }

    setActionError(null);
    try {
      const next = await updateSamcoSettings({
        quantity,
        entryPriceMin,
        entryPriceMax,
        ruleVariant: ruleVariantInput,
        stopLossPct,
      });
      setSettings(next);
      clearInputsDirty();
      setQuantityInput(String(next.effectiveQuantity));
      setMinPriceInput(String(next.entryPriceMin));
      setMaxPriceInput(String(next.entryPriceMax));
      setStopLossPctInput(
        next.stopLossPct == null ? "" : String(next.stopLossPct),
      );
      setRuleVariantInput(resolveRuleVariant(next.ruleVariant));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setActionError(message);
      throw err;
    }
  }, [
    quantityInput,
    minPriceInput,
    maxPriceInput,
    stopLossPctInput,
    ruleVariantInput,
    clearInputsDirty,
  ]);

  const refreshSession = useCallback(async () => {
    setActionError(null);
    setRefreshInfo(null);
    try {
      const session = await refreshSamcoSession();
      await refresh({ silent: true });
      const status = await fetchSamcoStatus();
      setStatus(status);
      if (!session.connected && !status.connected) {
        setRefreshInfo("Session refresh returned without a connected token.");
      } else if (status.requiredStaticIp && status.staticIpMatched === false) {
        setRefreshInfo(
          status.staticIpMessage ??
            `Session connected, but egress IP ${status.srcIp ?? "unknown"} does not match required ${status.requiredStaticIp}. Live orders are blocked.`,
        );
      } else {
        setRefreshInfo(
          status.requiredStaticIp
            ? `Samco session connected — egress IP ${status.srcIp ?? "ok"} matches ${status.requiredStaticIp}. Ready for live orders when Live is on and Dry run is off.`
            : "Samco session connected — whoami OK. Ready for live order requests when Live is on and Dry run is off.",
        );
      }
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

  const [exitingSignalKey, setExitingSignalKey] = useState<string | null>(null);

  const squareOffPosition = useCallback(
    async (signalKey: string) => {
      setActionError(null);
      setRefreshInfo(null);
      setExitingSignalKey(signalKey);
      try {
        const result = await squareOffSamcoLedgerEntry(signalKey);
        setLedger(result.ledger);
        setOrders(result.orders);
        setStatus(result.status);
        setRefreshInfo(`Manual exit placed for ${signalKey}.`);
        await refresh({ silent: true });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setActionError(message);
        throw err;
      } finally {
        setExitingSignalKey(null);
      }
    },
    [refresh],
  );

  const modeLabel =
    settings?.dryRun === false && settings?.liveTradingEnabled
      ? "LIVE"
      : "SIMULATED";

  const ordersReachSamco =
    Boolean(status?.connected) &&
    settings?.dryRun === false &&
    settings?.liveTradingEnabled === true;

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
    stopLossPctInput,
    setStopLossPctInput: (value: string) => {
      markInputsDirty();
      setStopLossPctInput(value);
    },
    ruleVariantInput,
    applyRuleVariant,
    loading,
    refreshing,
    error,
    actionError,
    refreshInfo,
    modeLabel,
    ordersReachSamco,
    exitingSignalKey,
    refresh: () => refresh({ runCycle: true }),
    setDryRun,
    setLiveTrading,
    applyDayQuantity,
    applyEntryPriceRange,
    applyStopLossPct,
    applyTradingParams,
    refreshSession,
    downloadLogs,
    squareOffPosition,
  };
}
