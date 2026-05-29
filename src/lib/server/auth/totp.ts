import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

import { generateSecret, generateURI, verify } from "otplib";

const BACKUP_CODE_LENGTH = 10;
const BACKUP_CODE_COUNT = 8;
const ENCRYPTION_PREFIX = "enc:v1:";
const BACKUP_HASH_PREFIX = "sha256:v1:";

function getSecretMaterial() {
  return (
    process.env.MAKERSHELF_AUTH_SECRET ||
    process.env.PRINTVAULT_AUTH_SECRET ||
    process.env.OPV_AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.AUTH_SECRET ||
    process.env.DATABASE_URL ||
    "print-vault-local-development-secret"
  );
}

function getEncryptionKey() {
  return createHash("sha256").update(getSecretMaterial()).digest();
}

function toBase64Url(buffer: Buffer) {
  return buffer.toString("base64url");
}

function fromBase64Url(value: string) {
  return Buffer.from(value, "base64url");
}

function normalizeBackupCode(code: string) {
  return code.replace(/[\s-]+/g, "").trim().toUpperCase();
}

export function encryptTotpSecret(secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${ENCRYPTION_PREFIX}${toBase64Url(iv)}.${toBase64Url(tag)}.${toBase64Url(encrypted)}`;
}

export function decryptTotpSecret(value: string) {
  if (!value.startsWith(ENCRYPTION_PREFIX)) {
    return value;
  }

  const [ivRaw, tagRaw, encryptedRaw] = value.slice(ENCRYPTION_PREFIX.length).split(".");
  if (!ivRaw || !tagRaw || !encryptedRaw) {
    throw new Error("2FA-Secret ist ungueltig gespeichert.");
  }

  const decipher = createDecipheriv("aes-256-gcm", getEncryptionKey(), fromBase64Url(ivRaw));
  decipher.setAuthTag(fromBase64Url(tagRaw));
  return Buffer.concat([
    decipher.update(fromBase64Url(encryptedRaw)),
    decipher.final(),
  ]).toString("utf8");
}

export function createTotpSecret(appName: string, email: string) {
  const secret = generateSecret();
  const otpauthUrl = generateURI({
    issuer: appName,
    label: email,
    secret,
    algorithm: "sha1",
    digits: 6,
    period: 30,
  });

  return {
    secret,
    otpauthUrl,
  };
}

export function verifyTotpToken(secret: string, token: string) {
  return verify({
    token,
    secret: decryptTotpSecret(secret),
  });
}

export function createBackupCodes() {
  return Array.from({ length: BACKUP_CODE_COUNT }, () => {
    const raw = randomBytes(8).toString("base64url").replace(/[^A-Z0-9]/gi, "").toUpperCase();
    return raw.slice(0, BACKUP_CODE_LENGTH).padEnd(BACKUP_CODE_LENGTH, "X");
  });
}

export function hashBackupCode(code: string) {
  return `${BACKUP_HASH_PREFIX}${createHash("sha256")
    .update(`${getSecretMaterial()}:${normalizeBackupCode(code)}`)
    .digest("hex")}`;
}

export function hashBackupCodes(codes: string[]) {
  return codes.map(hashBackupCode);
}

export function verifyBackupCode(storedCode: string, token: string) {
  const normalizedToken = normalizeBackupCode(token);
  if (!normalizedToken) {
    return false;
  }

  const expected = storedCode.startsWith(BACKUP_HASH_PREFIX)
    ? storedCode
    : hashBackupCode(storedCode);
  const actual = hashBackupCode(normalizedToken);
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);

  return (
    expectedBuffer.length === actualBuffer.length &&
    timingSafeEqual(expectedBuffer, actualBuffer)
  );
}
