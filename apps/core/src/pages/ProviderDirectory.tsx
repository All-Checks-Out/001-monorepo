import { listProviders } from "@frontend/api/onboarding/client";
import type { Corporation } from "@frontend/api/onboarding/types";
import { useEffect, useState } from "react";
import Page from "../components/Page";
import SimpleTable from "../tables/SimpleTable";
import Status from "../components/Status";
import TableIntro from "../components/TableIntro";

const ProviderDirectory = () => {
  const [providers, setProviders] = useState<
    Pick<Corporation, "id" | "name">[]
  >([]);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadProviders() {
      try {
        const providerResult = await listProviders();
        setProviders(providerResult);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Could not load providers.",
        );
      }
    }

    void loadProviders();
  }, []);

  return (
    <Page title="Providers">
      <TableIntro
        title="Approved Providers"
        text="Agent and Stakeholder setup requests are made from the public registration page and target one of these Providers."
      />
      <SimpleTable
        headers={["ID", "Name"]}
        rows={providers.map((provider) => ({
          id: provider.id,
          values: [String(provider.id), provider.name],
        }))}
        empty="No approved providers."
      />
      <Status error={error} />
    </Page>
  );
};

export default ProviderDirectory;
