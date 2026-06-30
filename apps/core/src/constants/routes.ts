const CORE_BASE_PATH = "/core";

function toCoreShellPath(path: string) {
  return path === "/" ? CORE_BASE_PATH : `${CORE_BASE_PATH}${path}`;
}

function toCoreShellPaths(paths: string[]) {
  return paths.map(toCoreShellPath);
}

const CORE_ROUTES = {
  home: "/",
  callback: "/callback",
  profile: "/profile",
  associationProviders: "/association/providers",
  associationSystemData: "/association/system-data",
  associationUsers: "/association/users",
  associationAccessRequests: "/association/access-requests",
  associationDDQPacks: "/association/ddq-packs",
  associationDDQPackRoute: "/association/ddq-packs/:packId",
  associationDDQPack: (packId: number | string) =>
    `/association/ddq-packs/${packId}`,
  associationDDQPackReadOnly: (packId: number | string) =>
    `/association/ddq-packs/${packId}?mode=read-only`,
  providerDDQPacks: "/provider/ddq-packs",
  providerDDQPackChecklistRoute: "/provider/ddq-packs/:packId/checklist",
  providerDDQPackChecklist: (packId: number | string) =>
    `/provider/ddq-packs/${packId}/checklist`,
  providerDDQPackChecklistTaskRoute:
    "/provider/ddq-packs/:packId/checklist/tasks/:taskId",
  providerDDQPackChecklistTask: (
    packId: number | string,
    taskId: number | string,
  ) => `/provider/ddq-packs/${packId}/checklist/tasks/${taskId}`,
  providerUsers: "/provider/users",
  providerSetupRequests: "/provider/setup-requests",
  providerAccessRequests: "/provider/access-requests",
  agentProviders: "/agent/providers",
  agentRequests: "/agent/requests",
  agentUsers: "/agent/users",
  stakeholderProviders: "/stakeholder/providers",
  stakeholderRequests: "/stakeholder/requests",
  stakeholderUsers: "/stakeholder/users",
} as const;

export { CORE_BASE_PATH, CORE_ROUTES, toCoreShellPath, toCoreShellPaths };
