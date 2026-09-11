import { useRef } from "react";
import type { ChangeEvent } from "react";
import { PaperclipIcon } from "./icons";
import "./FileInput.css";

interface FileInputProps {
  id?: string;
  accept?: string;
  file: File | null;
  onChange: (file: File | null) => void;
  disabled?: boolean;
}

export function FileInput({ id, accept, file, onChange, disabled }: FileInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    onChange(e.target.files?.[0] ?? null);
  }

  return (
    <div className="md-file-input">
      <button
        type="button"
        className="md-file-input__trigger"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        <PaperclipIcon /> Choose file
      </button>
      <span className={file ? "md-file-input__name" : "md-file-input__placeholder"}>
        {file ? file.name : "No file chosen"}
      </span>
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={accept}
        disabled={disabled}
        onChange={handleChange}
        style={{ display: "none" }}
      />
    </div>
  );
}
