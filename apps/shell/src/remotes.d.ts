type RemoteBridgeModule = {
  default: () => {
    render(info: {
      dom: HTMLElement;
      basename?: string;
      [key: string]: unknown;
    }): Promise<void>;
    destroy(info: { dom: HTMLElement; moduleName?: string }): void;
  };
};

declare module "core/app" {
  const provider: RemoteBridgeModule["default"];

  export default provider;
}

declare module "form_design/app" {
  const provider: RemoteBridgeModule["default"];

  export default provider;
}
