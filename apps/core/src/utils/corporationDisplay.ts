import type { CorporationType } from "@shared/permissions";

const displayCorporationType = (type: CorporationType) => {
  if (type === "AGENT") return "Agency";
  return type.charAt(0) + type.slice(1).toLowerCase();
};

export { displayCorporationType };
