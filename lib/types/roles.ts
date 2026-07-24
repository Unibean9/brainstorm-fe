export const ROLE_ADMIN = "ROLE_ADMIN";
export const ROLE_FACILITATOR = "ROLE_FACILITATOR";
export const ROLE_PARTICIPANT = "ROLE_PARTICIPANT";

export type UserRole =
  | typeof ROLE_ADMIN
  | typeof ROLE_FACILITATOR
  | typeof ROLE_PARTICIPANT;
