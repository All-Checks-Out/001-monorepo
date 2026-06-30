import type { AccessRequest } from "@frontend/api/onboarding/types";
import ApprovalTable from "../tables/ApprovalTable";
import Page from "../components/Page";
import Status from "../components/Status";
import StatusBadge from "../components/StatusBadge";

interface AccessRequestActionsProps {
  title: string;
  requests: AccessRequest[];
  error: string;
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
  canApprove: (request: AccessRequest) => boolean;
}

const AccessRequestActions = ({
  title,
  requests,
  error,
  onApprove,
  onReject,
  canApprove,
}: AccessRequestActionsProps) => {
  return (
    <Page title={title}>
      <ApprovalTable
        headers={["Requester", "Type", "Provider", "Status"]}
        rows={requests.map((item) => ({
          id: item.id,
          values: [
            item.requester_corporation_name ??
              String(item.requester_corporation_id),
            item.requester_corporation_type ?? "",
            item.provider_corporation_name ??
              String(item.provider_corporation_id),
            <StatusBadge status={item.status} />,
          ],
          disabled: item.status !== "pending" || !canApprove(item),
        }))}
        onApprove={onApprove}
        onReject={onReject}
        empty="No access requests."
      />
      <Status error={error} />
    </Page>
  );
};

export default AccessRequestActions;
