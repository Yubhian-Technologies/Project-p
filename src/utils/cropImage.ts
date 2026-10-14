import type { Area } from "react-easy-crop";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener("load", () => resolve(img));
    img.addEventListener("error", (e) => reject(e));
    img.crossOrigin = "anonymous";
    img.src = src;
  });
}

/** Renders just the cropped area onto a square canvas and returns it as a
    JPEG blob — output is capped at `outputSize` so a huge original photo
    doesn't turn into an oversized avatar upload. */
export async function getCroppedImageBlob(
  imageSrc: string,
  cropPixels: Area,
  outputSize = 512,
): Promise<Blob> {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement("canvas");
  canvas.width = outputSize;
  canvas.height = outputSize;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not supported in this browser.");

  ctx.drawImage(
    image,
    cropPixels.x,
    cropPixels.y,
    cropPixels.width,
    cropPixels.height,
    0,
    0,
    outputSize,
    outputSize,
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not create the cropped image."))),
      "image/jpeg",
      0.92,
    );
  });
}
