import type { CorporationType } from "@shared/permissions";

type ApplicationType = Exclude<CorporationType, "ASSOCIATION">;

const applicationNamePlaceholders: Record<ApplicationType, string> = {
  PROVIDER: "Provider name",
  AGENT: "Agency name",
  STAKEHOLDER: "Stakeholder name",
};

const applicationSuccessMessages: Record<ApplicationType, string> = {
  PROVIDER:
    "Provider application submitted. An Association user must approve it before an invitation email is sent.",
  AGENT:
    "Agency application submitted. The selected Provider must approve it before an invitation email is sent.",
  STAKEHOLDER:
    "Stakeholder application submitted. The selected Provider must approve it before an invitation email is sent.",
};

export {
  applicationNamePlaceholders,
  applicationSuccessMessages,
};
export type { ApplicationType };
