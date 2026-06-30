import { Button } from "@frontend/shadcn/components/ui/button";
import { useAuth } from "@frontend/auth/session/AuthProvider";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

const Callback = () => {
  const [params] = useSearchParams();
  const { completeOAuthCallback } = useAuth();
  const hasProcessed = useRef(false);
  const [message, setMessage] = useState("Signing you in...");
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (hasProcessed.current) return;

    const code = params.get("code");
    const state = params.get("state");
    const errorParam = params.get("error");
    const errorDescription = params.get("error_description");

    if (errorParam) {
      setMessage(errorDescription ?? errorParam);
      setHasError(true);
      return;
    }

    if (!code || !state) {
      setMessage("Missing authorization code or state");
      setHasError(true);
      return;
    }

    hasProcessed.current = true;
    const authorizationCode = code;
    const oauthState = state;

    async function finishLogin() {
      try {
        await completeOAuthCallback(authorizationCode, oauthState);
        window.location.replace("/core");
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "Failed to complete authentication",
        );
        setHasError(true);
      }
    }

    void finishLogin();
  }, [params, completeOAuthCallback]);

  return (
    <div className="mx-auto max-w-7xl p-4 pt-0">
      <p
        className={
          hasError ? "text-sm text-destructive" : "text-sm text-muted-foreground"
        }
      >
        {message}
      </p>
      {hasError && (
        <Button className="mt-4" asChild>
          <a href="/core">Back to home</a>
        </Button>
      )}
    </div>
  );
};

export default Callback;
