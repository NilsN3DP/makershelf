import { randomBytes } from "node:crypto";

export function generateInviteToken() {
  return randomBytes(24).toString("hex");
}
