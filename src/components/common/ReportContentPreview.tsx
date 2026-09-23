import { DownloadIcon } from "./icons";
import "./ReportContentPreview.css";

// A report can run to hundreds of lines, which is unreadable stuffed into a small
// scrolling box — so instead of showing it inline, this just offers the PDF.
interface ReportContentPreviewProps {
  onDownload: () => void;
  downloading?: boolean;
}

export function ReportContentPreview({ onDownload, downloading }: ReportContentPreviewProps) {
  return (
    <div className="report-preview">
      <button type="button" className="report-preview__download" onClick={onDownload} disabled={downloading}>
        <DownloadIcon /> {downloading ? "Preparing PDF…" : "Download PDF"}
      </button>
    </div>
  );
}
