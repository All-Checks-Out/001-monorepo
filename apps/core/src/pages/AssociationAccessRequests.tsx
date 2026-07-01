import type { AccessRequest } from "@frontend/api/onboarding/types";
import {
  approveAccessRequest,
  listAccessRequests,
  rejectAccessRequest,
} from "@frontend/api/onboarding/client";
import { useEffect, useState } from "react";
import { useCurrentUser } from "../context/CurrentUserContext";
import AccessRequestActions from "./AccessRequestActions";

const AssociationAccessRequests = () => {
  const { hasPermission } = useCurrentUser();
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [error, setError] = useState("");

  async function load() {
    const result = await listAccessRequests();
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
      if (action === "approve") await approveAccessRequest(id);
      else await rejectAccessRequest(id);
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not update access request.",
      );
    }
  }

  return (
    <AccessRequestActions
      title="Access requests"
      requests={requests}
      error={error}
      canApprove={() => hasPermission("association-provider-requests:approve")}
      onApprove={(id) => decide(id, "approve")}
      onReject={(id) => decide(id, "reject")}
    />
  );
};

export default AssociationAccessRequests;
