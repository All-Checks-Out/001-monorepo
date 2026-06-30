import { useAuth } from "@frontend/auth/session/AuthProvider";
import { createRootUser } from "@frontend/api/onboarding/client";
import { Button } from "@frontend/shadcn/components/ui/button";
import { Input } from "@frontend/shadcn/components/ui/input";
import { useState } from "react";
import onboardingHero from "../assets/due-diligence-pexels.jpg";
import HomeRegistrationForm, {
  type ApplicationType,
} from "../components/HomeRegistrationForm";
import Page from "../components/Page";
import { useRootSetup } from "../context/RootSetupContext";

interface HomeProps {
  hostAuth?: {
    isLoggedIn: boolean;
    loading: boolean;
  };
}

const Home = ({ hostAuth }: HomeProps) => {
  const auth = useAuth();
  const isLoggedIn = hostAuth?.isLoggedIn ?? auth.isLoggedIn;
  const authLoading = hostAuth?.loading ?? auth.loading;
  const { rootConfigured, rootSetupError, setRootSetupError } =
    useRootSetup();
  const [rootEmail, setRootEmail] = useState("");
  const [rootSetupMessage, setRootSetupMessage] = useState("");
  const [rootSetupLoading, setRootSetupLoading] = useState(false);
  const [registrationType, setRegistrationType] =
    useState<ApplicationType | null>(null);

  async function submitRootUser() {
    setRootSetupLoading(true);
    setRootSetupMessage("");
    setRootSetupError("");

    try {
      const email = rootEmail.trim();
      await createRootUser(email);
      setRootSetupMessage(
        `An invitation email has been sent to ${email} with a temporary password. Please read the invitation email, login above to initialize the system, then go to the users tab and invite a new user to join and create a new provider.`,
      );
      setRootEmail("");
    } catch (error) {
      setRootSetupError(
        error instanceof Error ? error.message : "Could not create root user.",
      );
    } finally {
      setRootSetupLoading(false);
    }
  }

  if (rootConfigured === null) {
    return (
      <Page title="Due diligence onboarding">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </Page>
    );
  }

  if (!rootConfigured) {
    return (
      <Page title="Due diligence onboarding">
        <p className="text-sm text-muted-foreground">
          Please supply an email address for the root user to login.
        </p>
        <div className="grid max-w-xl gap-3">
          <Input
            type="email"
            value={rootEmail}
            disabled={rootSetupLoading || !!rootSetupMessage}
            placeholder="name@example.com"
            onChange={(event) => setRootEmail(event.target.value)}
          />
          <Button
            className="w-fit"
            type="button"
            disabled={
              rootSetupLoading || !rootEmail.trim() || !!rootSetupMessage
            }
            onClick={submitRootUser}
          >
            Send
          </Button>
        </div>
        {rootSetupMessage && (
          <p className="max-w-2xl text-sm font-medium text-destructive">
            {rootSetupMessage}
          </p>
        )}
        {rootSetupError && (
          <p className="text-sm text-destructive">{rootSetupError}</p>
        )}
      </Page>
    );
  }

  return (
    <Page title="Due diligence onboarding">
      <img
        src={onboardingHero}
        alt="Provider onboarding and due diligence review"
        className="aspect-[16/7] w-full rounded-md object-cover"
      />
      {!authLoading && !isLoggedIn && (
        <>
          <p className="text-sm text-muted-foreground">
            If you would like to register to be a provider{" "}
            <button
              className="font-medium text-primary underline-offset-4 hover:underline"
              type="button"
              onClick={() => setRegistrationType("PROVIDER")}
            >
              click here
            </button>
            .
          </p>
          <p className="text-sm text-muted-foreground">
            If you would like to register to be an agent{" "}
            <button
              className="font-medium text-primary underline-offset-4 hover:underline"
              type="button"
              onClick={() => setRegistrationType("AGENT")}
            >
              click here
            </button>
            .
          </p>
          <p className="text-sm text-muted-foreground">
            If you would like to register to be a stakeholder{" "}
            <button
              className="font-medium text-primary underline-offset-4 hover:underline"
              type="button"
              onClick={() => setRegistrationType("STAKEHOLDER")}
            >
              click here
            </button>
            .
          </p>
          {registrationType && <HomeRegistrationForm type={registrationType} />}
        </>
      )}
    </Page>
  );
};

export default Home;
