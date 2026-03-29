import { randomBytes } from "node:crypto";

const CHARSET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;
const MAX_RETRIES = 100;

export function generateRoomCode(): string {
  const limit = 256 - (256 % CHARSET.length);
  let code = "";
  while (code.length < CODE_LENGTH) {
    const bytes = randomBytes(CODE_LENGTH - code.length);
    for (let i = 0; i < bytes.length && code.length < CODE_LENGTH; i++) {
      if (bytes[i] < limit) {
        code += CHARSET[bytes[i] % CHARSET.length];
      }
    }
  }
  return code;
}

export function generateUniqueRoomCode(existingCodes: Set<string>): string {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const code = generateRoomCode();
    if (!existingCodes.has(code)) {
      return code;
    }
  }
  throw new Error(`Failed to generate unique room code after ${MAX_RETRIES} attempts`);
}
