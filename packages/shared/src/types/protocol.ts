export const PROTOCOL_VERSION = 1;

export interface ServerErrorMessage {
  version: typeof PROTOCOL_VERSION;
  type: "ERROR";
  code: string;
  message: string;
}
