import type { UploadMetadata } from "firebase/storage";

/**
 * Forces browsers to download the file (PDFs otherwise just open inline in a
 * new tab) by setting Content-Disposition: attachment at upload time. This
 * works via a plain `<a href download>` link with no CORS dependency —
 * unlike fetching the file client-side to build a blob download, which
 * silently fails on Firebase Storage buckets that have no CORS configured.
 */
export function attachmentMetadata(fileName: string): UploadMetadata {
  return { contentDisposition: `attachment; filename="${fileName.replace(/"/g, '\\"')}"` };
}
