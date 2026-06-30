import type { DDQPack } from "@frontend/api/onboarding/types";
import type { DDQPackStatusAction } from "@frontend/api/onboarding/client";

type DDQPackStatusActionConfig = {
  action: DDQPackStatusAction;
  shortLabel: string;
  label: string;
  confirmVerb: string;
  confirmConsequence: string;
  successMessage: string;
};

function displayPackStatus(pack: DDQPack) {
  if (pack.status === "published") return "Published";
  if (pack.status === "archived") return "Archived";
  return "Draft";
}

function statusActionForPack(pack: DDQPack): DDQPackStatusActionConfig | null {
  if (pack.status === "draft") {
    return {
      action: "publish",
      shortLabel: "Publish",
      label: "Publish Pack",
      confirmVerb: "Publish",
      confirmConsequence: "This will make the pack available immediately.",
      successMessage: "DDQ Pack published.",
    };
  }

  if (pack.status === "published") {
    return {
      action: "archive",
      shortLabel: "Archive",
      label: "Archive Pack",
      confirmVerb: "Archive",
      confirmConsequence: "This will make the pack unavailable immediately.",
      successMessage: "DDQ Pack archived.",
    };
  }

  if (pack.status === "archived") {
    return {
      action: "restore",
      shortLabel: "Restore",
      label: "Restore Pack",
      confirmVerb: "Restore",
      confirmConsequence: "Its validity dates will apply again immediately.",
      successMessage: "DDQ Pack restored.",
    };
  }

  return null;
}

export { displayPackStatus, statusActionForPack };
