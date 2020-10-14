import { DistributedFile } from "../types";
import params from "../params";

/**
 * Return a queriable gateway url for a distributed file
 * @param distributedFile
 * @returns link to fetch file "http://ipfs-gateway/Qm7763518d4"
 */
export function fileToGatewayUrl(distributedFile?: DistributedFile): string {
  // Fallback
  if (!distributedFile || !distributedFile.hash) return "";

  const hash = normalizeHash(distributedFile.hash);
  return `${params.ipfsGateway}${hash}`;
}

/**
 * Stringifies a distributed file type into a single multiaddress string
 * @param distributedFile
 * @returns multiaddress "/ipfs/Qm"
 */
export function fileToMultiaddress(distributedFile?: DistributedFile): string {
  if (!distributedFile || !distributedFile.hash) return "";

  if (distributedFile.source === "ipfs")
    return `/ipfs/${normalizeHash(distributedFile.hash)}`;
  else return "";
}

/**
 * Return a queriable gateway url for a multiaddress
 * @param multiaddress "/ipfs/Qm"
 * @returns link to fetch file "http://ipfs-gateway/Qm7763518d4"
 */
export function multiaddressToGatewayUrl(multiaddress: string): string {
  const hash = normalizeHash(multiaddress);
  return fileToGatewayUrl({ source: "ipfs", hash, size: 0 });
}

/**
 * Normalizes a hash removing it's prefixes
 * - Remove any number of trailing slashes
 * - Split by non alphanumeric character and return the last string
 * "/ipfs/Qm" => "Qm"
 * "ipfs"
 * @param hash "/ipfs/Qm" | "ipfs:Qm" | "Qm"
 * @returns "Qm"
 */
export function normalizeHash(hash: string): string {
  return (
    hash
      // remove any number of trailing slashes
      .replace(/\/+$/, "")
      .trim()
      //
      .split(/[^a-zA-Z\d]/)
      .slice(-1)[0]
  );
}
