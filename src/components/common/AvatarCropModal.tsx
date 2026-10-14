import { useState } from "react";
import Cropper from "react-easy-crop";
import type { Area, Point } from "react-easy-crop";
import { Modal } from "./Modal";
import { Button } from "./Button";
import { getCroppedImageBlob } from "../../utils/cropImage";
import "./AvatarCropModal.css";

interface AvatarCropModalProps {
  imageSrc: string;
  onCancel: () => void;
  onSave: (blob: Blob) => Promise<void>;
}

/** Shown right after picking a profile photo — lets the person drag/zoom to
    frame it before it's uploaded, instead of using whatever crop the raw
    file happened to come in with. Always square + round, matching the
    circular Avatar it ends up in everywhere else in the app. */
export function AvatarCropModal({ imageSrc, onCancel, onSave }: AvatarCropModalProps) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!croppedAreaPixels) return;
    setSaving(true);
    setError(null);
    try {
      const blob = await getCroppedImageBlob(imageSrc, croppedAreaPixels);
      await onSave(blob);
    } catch {
      setError("Could not crop this image. Please try again.");
      setSaving(false);
    }
  }

  return (
    <Modal title="Adjust your photo" onClose={onCancel} className="avatar-crop-modal">
      <div className="avatar-crop-modal__stage">
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          aspect={1}
          cropShape="round"
          showGrid={false}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={(_area, pixels) => setCroppedAreaPixels(pixels)}
        />
      </div>

      <div className="avatar-crop-modal__zoom">
        <span>Zoom</span>
        <input
          type="range"
          min={1}
          max={3}
          step={0.01}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
        />
      </div>

      {error && <p className="avatar-crop-modal__error">{error}</p>}

      <div className="avatar-crop-modal__actions">
        <Button type="button" disabled={saving} onClick={handleSave}>
          {saving ? "Saving…" : "Save photo"}
        </Button>
        <Button type="button" variant="outlined" disabled={saving} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </Modal>
  );
}
