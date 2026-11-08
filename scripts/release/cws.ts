/**
 * Uploads a package to an existing Chrome Web Store item and submits it for review (Chrome Web Store API v2).
 *
 *   node scripts/release/cws.ts <package.zip>
 *
 * Environment:
 *   CWS_ACCESS_TOKEN   OAuth access token with the https://www.googleapis.com/auth/chromewebstore scope
 *   CWS_PUBLISHER_ID   Developer Dashboard → Account → Publisher ID
 *   CWS_EXTENSION_ID   the item's 32-letter ID
 *   CWS_PUBLISH_TYPE   DEFAULT_PUBLISH (go live after review, default) or STAGED_PUBLISH (wait for a manual publish)
 *   CWS_EXPECTED_VERSION  optional; fails if the uploaded package reports another version
 */
import { readFileSync } from "node:fs";

const API = "https://chromewebstore.googleapis.com";
const POLL_MS = 5_000;
const POLL_LIMIT_MS = 5 * 60_000;

const zipPath = process.argv[2];
const token = env("CWS_ACCESS_TOKEN");
const item = `publishers/${env("CWS_PUBLISHER_ID")}/items/${env("CWS_EXTENSION_ID")}`;
const publishType = process.env.CWS_PUBLISH_TYPE || "DEFAULT_PUBLISH";
if (!zipPath) fail("Usage: node scripts/release/cws.ts <package.zip>");
if (!["DEFAULT_PUBLISH", "STAGED_PUBLISH"].includes(publishType)) fail(`Unknown CWS_PUBLISH_TYPE ${publishType}`);

type UploadResponse = { uploadState?: string; crxVersion?: string };
type StatusResponse = { lastAsyncUploadState?: string; submittedItemRevisionStatus?: { state?: string } };
type PublishResponse = { state?: string; warningInfo?: { warnings?: { reason: string; description: string }[] } };

const upload = await call<UploadResponse>("POST", `${API}/upload/v2/${item}:upload`, {
  body: readFileSync(zipPath),
  contentType: "application/zip",
});
console.log(`Upload: ${upload.uploadState}${upload.crxVersion ? ` (version ${upload.crxVersion})` : ""}`);

let state = upload.uploadState;
for (const started = Date.now(); state === "IN_PROGRESS" || state === "UPLOAD_IN_PROGRESS"; ) {
  if (Date.now() - started > POLL_LIMIT_MS) fail("Upload still processing after 5 minutes; check the Developer Dashboard.");
  await new Promise((r) => setTimeout(r, POLL_MS));
  state = (await call<StatusResponse>("GET", `${API}/v2/${item}:fetchStatus`)).lastAsyncUploadState;
  console.log(`Upload: ${state}`);
}
if (state !== "SUCCEEDED") fail(`Upload did not succeed (${state}). The Developer Dashboard shows the reason.`);

const expected = process.env.CWS_EXPECTED_VERSION;
if (expected && upload.crxVersion && upload.crxVersion !== expected) {
  fail(`Uploaded package reports version ${upload.crxVersion}, expected ${expected}.`);
}

const published = await call<PublishResponse>("POST", `${API}/v2/${item}:publish`, {
  body: JSON.stringify({ publishType }),
  contentType: "application/json",
});
for (const w of published.warningInfo?.warnings ?? []) console.warn(`Warning ${w.reason}: ${w.description}`);
console.log(`Submitted for review with ${publishType}; item state: ${published.state}`);

async function call<T>(method: string, url: string, init: { body?: string | Uint8Array; contentType?: string } = {}): Promise<T> {
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (init.contentType) headers["Content-Type"] = init.contentType;
  const res = await fetch(url, { method, headers, body: init.body });
  const text = await res.text();
  if (!res.ok) fail(`${method} ${url} failed with ${res.status}:\n${text}`);
  return (text ? JSON.parse(text) : {}) as T;
}

function env(name: string): string {
  const value = process.env[name];
  if (!value) fail(`Missing environment variable ${name}`);
  return value;
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}
