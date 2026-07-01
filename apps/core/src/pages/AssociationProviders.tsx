import type { CorporationApplication } from "@frontend/api/onboarding/types";
import {
  approveCorporationApplication,
  listCorporationApplications,
  rejectCorporationApplication,
} from "@frontend/api/onboarding/client";
import { useEffect, useState } from "react";
import ApprovalTable from "../tables/ApprovalTable";
import Page from "../components/Page";
import Status from "../components/Status";
import StatusBadge from "../components/StatusBadge";
import { useCurrentUser } from "../context/CurrentUserContext";

const AssociationProviders = () => {
  const { hasPermission } = useCurrentUser();
  const [applications, setApplications] = useState<CorporationApplication[]>(
    [],
  );
  const [error, setError] = useState("");

  async function load() {
    const applicationResult = await listCorporationApplications();
    setApplications(applicationResult.applications);
  }

  useEffect(() => {
    async function loadApplications() {
      try {
        await load();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Could not load applications.",
        );
      }
    }

    void loadApplications();
  }, []);

  async function decide(id: number, action: "approve" | "reject") {
    setError("");

    try {
      if (action === "approve") await approveCorporationApplication(id);
      else await rejectCorporationApplication(id);
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not update application.",
      );
    }
  }

  const pendingProviderRequests = applications.filter(
    (application) => application.status === "pending",
  );
  const canApproveProviderRequests = hasPermission("association-provider-requests:approve");

  return (
    <Page title="Requests">
      <ApprovalTable
        headers={["Name", "Applicant", "Status"]}
        rows={pendingProviderRequests.map((application) => ({
          id: application.id,
          values: [
            application.name,
            application.applicant_email,
            <StatusBadge status={application.status} />,
          ],
          disabled: !canApproveProviderRequests,
        }))}
        onApprove={(id) => decide(id, "approve")}
        onReject={(id) => decide(id, "reject")}
        empty="No pending provider requests."
      />
      <Status error={error} />
    </Page>
  );
};

export default AssociationProviders;
