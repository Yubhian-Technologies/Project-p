import { useEffect, useMemo, useRef } from "react";
import type { ChangeEvent } from "react";
import { PaperclipIcon, XIcon } from "./icons";
import "./MultiPhotoInput.css";

interface MultiPhotoInputProps {
  id?: string;
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
  maxFiles?: number;
}

export function MultiPhotoInput({ id, files, onChange, disabled, maxFiles }: MultiPhotoInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // One object URL per file, revoked whenever the file list changes or this
  // component unmounts — otherwise each picked photo leaks a blob: URL.
  const previewUrls = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => {
    return () => {
      previewUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [previewUrls]);

  const atLimit = maxFiles !== undefined && files.length >= maxFiles;

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    const next = maxFiles ? [...files, ...picked].slice(0, maxFiles) : [...files, ...picked];
    onChange(next);
    e.target.value = ""; // allow picking the same file again later
  }

  function removeAt(index: number) {
    onChange(files.filter((_, i) => i !== index));
  }

  return (
    <div className="md-multi-photo-input">
      <div className="md-multi-photo-input__header">
        <button
          type="button"
          className="md-multi-photo-input__trigger"
          disabled={disabled || atLimit}
          onClick={() => inputRef.current?.click()}
        >
          <PaperclipIcon /> Add photos
        </button>
        <span className="md-multi-photo-input__count">
          {files.length > 0 ? `${files.length} photo${files.length === 1 ? "" : "s"}` : "No photos added"}
        </span>
      </div>
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept="image/*"
        multiple
        disabled={disabled || atLimit}
        onChange={handleChange}
        style={{ display: "none" }}
      />
      {files.length > 0 && (
        <div className="md-multi-photo-input__grid">
          {files.map((file, i) => (
            <div key={`${file.name}-${file.lastModified}-${i}`} className="md-multi-photo-input__thumb">
              <img src={previewUrls[i]} alt={file.name} />
              <button
                type="button"
                className="md-multi-photo-input__remove"
                aria-label={`Remove ${file.name}`}
                disabled={disabled}
                onClick={() => removeAt(i)}
              >
                <XIcon />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
