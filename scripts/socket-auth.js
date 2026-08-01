import { MODULE_ID, MODULE_TITLE } from "./constants.js";

const PUBLIC_KEY_FLAG = "socketPublicKey";
const AUTH_VERSION = 1;
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

let privateKey = null;
let initialization = null;

function canonicalize(value) {
  if (value === undefined) return null;
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((entry) => entry === undefined ? null : canonicalize(entry));
  return Object.fromEntries(Object.keys(value)
    .filter((key) => value[key] !== undefined)
    .sort()
    .map((key) => [key, canonicalize(value[key])]));
}

function canonicalString(value) {
  return JSON.stringify(canonicalize(value));
}

function bytesToBase64Url(bytes) {
  let binary = "";
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  const base64 = globalThis.btoa ? btoa(binary) : Buffer.from(binary, "binary").toString("base64");
  return base64.replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function base64UrlToBytes(value) {
  const normalized = String(value).replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = globalThis.atob ? atob(padded) : Buffer.from(padded, "base64").toString("binary");
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function storageKey() {
  return `${MODULE_ID}.socket-key.${game.world?.id ?? "world"}.${game.user?.id ?? "user"}`;
}

function getStoredPrivateJwk() {
  try {
    const raw = globalThis.localStorage?.getItem(storageKey());
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.warn(`${MODULE_TITLE} | Clé socket locale illisible`, error);
    return null;
  }
}

function storePrivateJwk(jwk) {
  try {
    globalThis.localStorage?.setItem(storageKey(), JSON.stringify(jwk));
  } catch (error) {
    console.warn(`${MODULE_TITLE} | Clé socket locale non persistée`, error);
  }
}

async function importPrivateKey(jwk) {
  return crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign"]
  );
}

async function createIdentity() {
  const pair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"]
  );
  const [privateJwk, publicJwk] = await Promise.all([
    crypto.subtle.exportKey("jwk", pair.privateKey),
    crypto.subtle.exportKey("jwk", pair.publicKey)
  ]);
  storePrivateJwk(privateJwk);
  return { privateKey: pair.privateKey, publicJwk };
}

async function loadOrCreateIdentity() {
  const stored = getStoredPrivateJwk();
  if (stored) {
    try {
      const imported = await importPrivateKey(stored);
      const publicJwk = { ...stored };
      delete publicJwk.d;
      publicJwk.key_ops = ["verify"];
      return { privateKey: imported, publicJwk };
    } catch (error) {
      console.warn(`${MODULE_TITLE} | Régénération de la clé socket`, error);
    }
  }
  return createIdentity();
}

export async function initializeSocketIdentity() {
  initialization ??= (async () => {
    if (!globalThis.crypto?.subtle || !game.user) throw new Error("WebCrypto est indisponible.");
    const identity = await loadOrCreateIdentity();
    privateKey = identity.privateKey;
    const existing = game.user.getFlag(MODULE_ID, PUBLIC_KEY_FLAG);
    if (canonicalString(existing) !== canonicalString(identity.publicJwk)) {
      await game.user.setFlag(MODULE_ID, PUBLIC_KEY_FLAG, identity.publicJwk);
    }
    return true;
  })().catch((error) => {
    initialization = null;
    privateKey = null;
    console.error(`${MODULE_TITLE} | Initialisation de l’identité socket impossible`, error);
    throw error;
  });
  return initialization;
}

function unsignedEnvelope(envelope) {
  const copy = structuredClone(envelope);
  if (copy.auth) delete copy.auth.signature;
  return copy;
}

export async function signSocketEnvelope(envelope) {
  await initializeSocketIdentity();
  const signed = structuredClone(envelope);
  signed.auth = {
    version: AUTH_VERSION,
    issuedAt: Date.now(),
    nonce: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
  };
  const bytes = new TextEncoder().encode(canonicalString(unsignedEnvelope(signed)));
  const signature = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, privateKey, bytes);
  signed.auth.signature = bytesToBase64Url(signature);
  return signed;
}

export async function verifySocketEnvelope(envelope, userId) {
  const auth = envelope?.auth;
  if (!auth || auth.version !== AUTH_VERSION) throw new Error("Signature de requête absente ou incompatible.");
  if (!Number.isFinite(auth.issuedAt) || Math.abs(Date.now() - auth.issuedAt) > MAX_CLOCK_SKEW_MS) {
    throw new Error("La requête signée a expiré.");
  }
  if (typeof auth.nonce !== "string" || auth.nonce.length < 8 || auth.nonce.length > 128) {
    throw new Error("Nonce de requête invalide.");
  }
  if (typeof auth.signature !== "string" || auth.signature.length > 256) {
    throw new Error("Signature de requête invalide.");
  }
  const user = game.users.get(userId);
  const publicJwk = user?.getFlag(MODULE_ID, PUBLIC_KEY_FLAG);
  if (!publicJwk) throw new Error("L’identité socket de ce joueur n’est pas initialisée.");
  const publicKey = await crypto.subtle.importKey(
    "jwk",
    publicJwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["verify"]
  );
  const bytes = new TextEncoder().encode(canonicalString(unsignedEnvelope(envelope)));
  const verified = await crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    publicKey,
    base64UrlToBytes(auth.signature),
    bytes
  );
  if (!verified) throw new Error("La signature de la requête est invalide.");
  return true;
}
