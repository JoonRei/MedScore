import "server-only";

export function getWebAuthnRequestConfig(request: Request) {
  const url = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const host = forwardedHost || url.host;
  const protocol = forwardedProto || url.protocol.replace(":", "");
  const hostname = host.split(":")[0];
  return {
    rpName: "MedScores",
    rpID: hostname,
    origin: `${protocol}://${host}`,
  };
}

export function bytesToBase64Url(bytes: Uint8Array) {
  return Buffer.from(bytes).toString("base64url");
}

export function base64UrlToBytes(value: string) {
  return new Uint8Array(Buffer.from(value, "base64url"));
}
