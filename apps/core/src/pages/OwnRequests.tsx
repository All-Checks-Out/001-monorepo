import type { AccessRequest } from "@frontend/api/onboarding/types";
import { listMyAccessRequests } from "@frontend/api/onboarding/client";
import { useEffect, useState } from "react";
import Page from "../components/Page";
import SimpleTable from "../tables/SimpleTable";
import Status from "../components/Status";
import StatusBadge from "../components/StatusBadge";

const OwnRequests = () => {
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadRequests() {
      try {
        const result = await listMyAccessRequests();
        setRequests(result.accessRequests);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Could not load requests.",
        );
      }
    }

    void loadRequests();
  }, []);

  return (
    <Page title="Requests">
      <SimpleTable
        headers={["Provider", "Provider ID", "Status"]}
        rows={requests.map((request) => ({
          id: request.id,
          values: [
            request.provider_corporation_name ?? "",
            String(request.provider_corporation_id),
            <StatusBadge status={request.status} />,
          ],
        }))}
        empty="No requests."
      />
      <Status error={error} />
    </Page>
  );
};

export default OwnRequests;
