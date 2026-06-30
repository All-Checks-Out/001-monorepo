import {
  approveProviderCorporationApplication,
  listProviderCorporationApplications,
  rejectProviderCorporationApplication,
} from "@frontend/api/onboarding/client";
import type { CorporationApplication } from "@frontend/api/onboarding/types";
import { useEffect, useState } from "react";
import ApprovalTable from "../tables/ApprovalTable";
import Page from "../components/Page";
import Status from "../components/Status";
import StatusBadge from "../components/StatusBadge";
import TableIntro from "../components/TableIntro";
import { useCurrentUser } from "../context/CurrentUserContext";

const ProviderSetupRequests = () => {
  const { hasPermission } = useCurrentUser();
  const [applications, setApplications] = useState<CorporationApplication[]>(
    [],
  );
  const [error, setError] = useState("");

  async function load() {
    const result = await listProviderCorporationApplications();
    setApplications(result.applications);
  }

  useEffect(() => {
    async function loadSetupRequests() {
      try {
        await load();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Could not load setup requests.",
        );
      }
    }

    void loadSetupRequests();
  }, []);

  async function decide(id: number, action: "approve" | "reject") {
    setError("");
    try {
      if (action === "approve") await approveProviderCorporationApplication(id);
      else await rejectProviderCorporationApplication(id);
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not update setup request.",
      );
    }
  }

  const agents = applications.filter(
    (application) => application.type === "AGENT",
  );
  const stakeholders = applications.filter(
    (application) => application.type === "STAKEHOLDER",
  );
  const canApproveAgentRequests = hasPermission("agent-requests:approve");
  const canApproveStakeholderRequests = hasPermission(
    "stakeholder-requests:approve",
  );

  return (
    <Page title="Setup requests">
      <TableIntro
        title="Requests to setup an Agent"
        text="These applications target your Provider corporation and create Agent corporations when approved."
      />
      <ApprovalTable
        headers={["Name", "Applicant", "Status"]}
        rows={agents.map((application) => ({
          id: application.id,
          values: [
            application.name,
            application.applicant_email,
            <StatusBadge status={application.status} />,
          ],
          disabled:
            application.status !== "pending" || !canApproveAgentRequests,
        }))}
        empty="No Agent setup requests."
        onApprove={(id) => decide(id, "approve")}
        onReject={(id) => decide(id, "reject")}
      />
      <TableIntro
        title="Requests to setup a Stakeholder"
        text="These applications target your Provider corporation and create Stakeholder corporations when approved."
      />
      <ApprovalTable
        headers={["Name", "Applicant", "Status"]}
        rows={stakeholders.map((application) => ({
          id: application.id,
          values: [
            application.name,
            application.applicant_email,
            <StatusBadge status={application.status} />,
          ],
          disabled:
            application.status !== "pending" || !canApproveStakeholderRequests,
        }))}
        empty="No Stakeholder setup requests."
        onApprove={(id) => decide(id, "approve")}
        onReject={(id) => decide(id, "reject")}
      />
      <Status error={error} />
    </Page>
  );
};

export default ProviderSetupRequests;
