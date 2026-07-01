import type { AccessRequest } from "@frontend/api/onboarding/types";
import {
  approveProviderAccessRequest,
  listProviderAccessRequests,
  rejectProviderAccessRequest,
} from "@frontend/api/onboarding/client";
import type { CorporationType } from "@shared/permissions";
import { useEffect, useState } from "react";
import { useCurrentUser } from "../context/CurrentUserContext";
import AccessRequestActions from "./AccessRequestActions";

const ProviderAccessRequests = () => {
  const { hasPermission } = useCurrentUser();
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [error, setError] = useState("");

  async function load() {
    const result = await listProviderAccessRequests();
    setRequests(result.accessRequests);
  }

  useEffect(() => {
    async function loadRequests() {
      try {
        await load();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Could not load access requests.",
        );
      }
    }

    void loadRequests();
  }, []);

  async function decide(id: number, action: "approve" | "reject") {
    setError("");

    try {
      if (action === "approve") await approveProviderAccessRequest(id);
      else await rejectProviderAccessRequest(id);
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not update access request.",
      );
    }
  }

  function canApproveRequest(requesterType: CorporationType | undefined) {
    if (requesterType === "AGENT") {
      return hasPermission("provider-agent-requests:approve");
    }

    if (requesterType === "STAKEHOLDER") {
      return hasPermission("provider-stakeholder-requests:approve");
    }

    return false;
  }

  return (
    <AccessRequestActions
      title="Access requests"
      requests={requests}
      error={error}
      canApprove={(request) =>
        canApproveRequest(request.requester_corporation_type)
      }
      onApprove={(id) => decide(id, "approve")}
      onReject={(id) => decide(id, "reject")}
    />
  );
};

export default ProviderAccessRequests;
