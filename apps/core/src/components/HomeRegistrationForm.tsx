import {
  createCorporationApplication,
  listProviders,
} from "@frontend/api/onboarding/client";
import type { Corporation } from "@frontend/api/onboarding/types";
import { Button } from "@frontend/shadcn/components/ui/button";
import { Input } from "@frontend/shadcn/components/ui/input";
import { useEffect, useState } from "react";
import {
  applicationNamePlaceholders,
  applicationSuccessMessages,
  type ApplicationType,
} from "../constants/corporation";

export type { ApplicationType };

interface HomeRegistrationFormProps {
  type: ApplicationType;
}

const HomeRegistrationForm = ({ type }: HomeRegistrationFormProps) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [providerId, setProviderId] = useState("");
  const [providers, setProviders] = useState<
    Pick<Corporation, "id" | "name">[]
  >([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (type === "PROVIDER") return;

    async function loadProviders() {
      try {
        const providerResult = await listProviders();
        setProviders(providerResult);
      } catch {
        setProviders([]);
      }
    }

    void loadProviders();
  }, [type]);

  async function submit() {
    setLoading(true);
    setMessage("");
    setError("");

    try {
      await createCorporationApplication(
        name.trim(),
        type,
        email.trim(),
        type === "PROVIDER" ? null : Number(providerId),
      );
      setSubmitted(true);
      setMessage(applicationSuccessMessages[type]);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not submit application.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid max-w-xl gap-3 border-t pt-4">
      <Input
        value={name}
        placeholder={applicationNamePlaceholders[type]}
        disabled={loading || submitted}
        onChange={(event) => setName(event.target.value)}
      />
      <Input
        type="email"
        value={email}
        placeholder="Applicant email"
        disabled={loading || submitted}
        onChange={(event) => setEmail(event.target.value)}
      />
      {type !== "PROVIDER" && (
        <select
          className="h-9 rounded-md border bg-background px-3 text-sm"
          value={providerId}
          disabled={loading || submitted}
          onChange={(event) => setProviderId(event.target.value)}
        >
          <option value="">Provider</option>
          {providers.map((provider) => (
            <option key={provider.id} value={provider.id}>
              {provider.name}
            </option>
          ))}
        </select>
      )}
      <Button
        className="w-fit"
        type="button"
        disabled={
          submitted ||
          loading ||
          !name.trim() ||
          !email.trim() ||
          (type !== "PROVIDER" && !providerId)
        }
        onClick={submit}
      >
        Submit
      </Button>
      {message && (
        <p className="text-sm font-medium text-destructive">{message}</p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
};

export default HomeRegistrationForm;
