import React, { useEffect, useRef, useState } from "react";
import { GOOGLE_CLIENT_ID } from "../env/environment";
import { loadGoogleScript } from "../helper/googleScript";

type ButtonText = "signin_with" | "signup_with" | "continue_with";

interface Props {
  /** Called with Google's signed ID token. The server verifies it; never trust it in the browser. */
  onCredential: (credential: string) => void;
  text?: ButtonText;
  /** Overridable for tests; defaults to REACT_APP_GOOGLE_CLIENT_ID. */
  clientId?: string;
}

/**
 * Google's own "Sign in with Google" button (Google Identity Services). Renders nothing when no client id is
 * configured, so the app works without Google set up.
 */
function GoogleSignInButton({ onCredential, text = "continue_with", clientId = GOOGLE_CLIENT_ID }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef(onCredential);
  latest.current = onCredential; // the callback registered with Google must always reach the current handler
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    loadGoogleScript()
      .then(() => {
        if (cancelled || !host.current) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response: { credential?: string }) => {
            if (response?.credential) latest.current(response.credential);
          },
          auto_select: false,
        });
        window.google.accounts.id.renderButton(host.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          text,
          shape: "rectangular",
          logo_alignment: "left",
          width: Math.min(host.current.offsetWidth || 300, 400),
        });
        setState("ready");
      })
      .catch(() => !cancelled && setState("error"));
    return () => {
      cancelled = true;
    };
  }, [clientId, text]);

  if (!clientId) return null;
  return (
    <div className="flex flex-col items-center gap-1 w-full">
      <div ref={host} data-testid="google-button" className="w-full flex justify-center min-h-[44px]" />
      {state === "loading" && <div className="text-[11px] text-gray-500">Loading Google sign-in...</div>}
      {state === "error" && (
        <div role="alert" className="text-[11px] text-highPriority font-semibold text-center">
          Google sign-in could not be loaded. Check your connection or ad blocker.
        </div>
      )}
    </div>
  );
}

export default GoogleSignInButton;
