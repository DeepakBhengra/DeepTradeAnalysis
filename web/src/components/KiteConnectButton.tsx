import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  fetchKiteStatus,
  submitKiteAccessToken,
  type KiteAuthStatus,
} from "../api/kiteAuth";

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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState("");
  const [showTokenForm, setShowTokenForm] = useState(false);

  const loginHref = useMemo(() => buildLoginHref(status), [status]);

  const loadStatus = useCallback(async () => {
    try {
      setLoading(true);
      const next = await fetchKiteStatus();
      setStatus(next);
      setError(null);
      if (!next.connected) {
        setShowTokenForm(true);
      }
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

  async function handleSaveToken(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      setSaving(true);
      setError(null);
      const next = await submitKiteAccessToken(accessToken);
      setStatus(next);
      setAccessToken("");
      setShowTokenForm(false);
      onConnected?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        {!connected && (
          <button
            type="button"
            onClick={() => setShowTokenForm((open) => !open)}
            className="cursor-pointer rounded-sm border border-kite-orange bg-kite-orange px-2.5 py-1 text-xs text-white hover:opacity-90"
          >
            {loading ? "Checking Kite..." : "Enter Kite token"}
          </button>
        )}
        {connected ? (
          <button
            type="button"
            onClick={() => setShowTokenForm((open) => !open)}
            className="cursor-pointer rounded-sm border border-kite-green px-2.5 py-1 text-xs text-kite-green hover:bg-kite-surface"
          >
            Update Kite token
          </button>
        ) : null}
        {loginHref ? (
          <a
            href={loginHref}
            className="inline-flex cursor-pointer items-center rounded-sm border border-kite-border bg-kite-surface px-2.5 py-1 text-xs text-kite-text no-underline hover:bg-kite-bg"
          >
            {connected ? "Reconnect via Zerodha" : "Login via Zerodha"}
          </a>
        ) : null}
      </div>

      {showTokenForm && (
        <form
          onSubmit={(event) => void handleSaveToken(event)}
          className="mt-1 flex w-[min(100vw-2rem,320px)] flex-col items-stretch gap-1.5 rounded-sm border border-kite-border bg-kite-surface p-2"
        >
          <label className="text-[10px] font-medium uppercase tracking-wide text-kite-muted">
            Kite access token
          </label>
          <input
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={accessToken}
            onChange={(event) => setAccessToken(event.target.value)}
            placeholder="Paste today's access token"
            className="border border-kite-border bg-kite-bg px-2 py-1.5 text-xs text-kite-text outline-none focus:border-kite-orange"
          />
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setShowTokenForm(false);
                setAccessToken("");
                setError(null);
              }}
              className="cursor-pointer rounded-sm border border-kite-border bg-kite-bg px-2 py-1 text-[10px] text-kite-text hover:bg-kite-surface"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || accessToken.trim().length === 0}
              className="cursor-pointer rounded-sm border border-kite-orange bg-kite-orange px-2 py-1 text-[10px] font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save token"}
            </button>
          </div>
        </form>
      )}

      <p className="m-0 max-w-[240px] text-right text-[10px] text-kite-muted">
        {connected
          ? "Kite session active for today"
          : "Paste today's Kite access token to connect"}
      </p>
      {error && (
        <p className="m-0 max-w-[280px] text-right text-[10px] text-kite-red">
          {error}
        </p>
      )}
    </div>
  );
}
