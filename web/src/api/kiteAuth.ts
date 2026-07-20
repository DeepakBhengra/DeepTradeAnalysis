export interface KiteAuthStatus {
  connected: boolean;
  redirectUrl: string;
  appUrl: string;
  loginUrl: string;
}

export async function fetchKiteStatus(): Promise<KiteAuthStatus> {
  let response: Response;

  try {
    response = await fetch("/api/kite/status");
  } catch {
    throw new Error(
      "Cannot reach the API on port 3001. Start both servers with: npm run dev:dashboard",
    );
  }

  if (response.status === 404) {
    throw new Error(
      "Kite routes missing on API (404). Stop old servers and run: npm run dev:api",
    );
  }

  if (!response.ok) {
    throw new Error(`Kite status request failed: ${response.status}`);
  }

  return response.json() as Promise<KiteAuthStatus>;
}
