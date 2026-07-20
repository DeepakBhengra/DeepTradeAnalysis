import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchKiteStatus, type KiteAuthStatus } from "../api/kiteAuth";

interface KiteConnectButtonProps {
  onConnected?: () => void;
}

function buildLoginHref(status: KiteAuthStatus | null): string | null {
  if (!status?.loginUrl) {
    return null;
  }

  const returnTo = encodeURIComponent(window.location.origin);
  return `${status.loginUrl}?return_to=${returnTo}`;
}

export function KiteConnectButton({ onConnected }: KiteConnectButtonProps) {
  const [status, setStatus] = useState<KiteAuthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loginHref = useMemo(() => buildLoginHref(status), [status]);

  const loadStatus = useCallback(async () => {
    try {
      setLoading(true);
      const next = await fetchKiteStatus();
      setStatus(next);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(
        `${message} Start the API if needed: npm run dev:dashboard`,
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("kite") !== "connected") {
      return;
    }

    params.delete("kite");
    params.delete("user");
    const nextSearch = params.toString();
    const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}`;
    window.history.replaceState({}, "", nextUrl);

    void loadStatus().then(() => {
      onConnected?.();
    });
  }, [loadStatus, onConnected]);

  const connected = status?.connected ?? false;

  return (
    <div className="flex flex-col items-end gap-1">
      {loginHref ? (
        <a
          href={loginHref}
          className={`inline-flex cursor-pointer items-center rounded-sm border px-2.5 py-1 text-xs no-underline ${
            connected
              ? "border-kite-green text-kite-green hover:bg-kite-surface"
              : "border-kite-orange bg-kite-orange text-white hover:opacity-90"
          }`}
        >
          {loading ? "Checking Kite..." : connected ? "Reconnect Kite" : "Connect Kite"}
        </a>
      ) : (
        <button
          type="button"
          disabled={loading}
          onClick={() => void loadStatus()}
          className="cursor-pointer rounded-sm border border-kite-border bg-kite-bg px-2.5 py-1 text-xs text-kite-text hover:bg-kite-surface disabled:opacity-60"
        >
          {loading ? "Checking Kite..." : "Connect Kite"}
        </button>
      )}
      <p className="m-0 max-w-[240px] text-right text-[10px] text-kite-muted">
        {connected
          ? "Kite session active for today"
          : "Opens API login on port 3001"}
      </p>
      {status?.redirectUrl && (
        <p className="m-0 max-w-[240px] truncate text-right text-[10px] text-kite-muted">
          Callback: {status.redirectUrl}
        </p>
      )}
      {error && (
        <p className="m-0 max-w-[240px] text-right text-[10px] text-kite-red">
          {error}
        </p>
      )}
    </div>
  );
}
