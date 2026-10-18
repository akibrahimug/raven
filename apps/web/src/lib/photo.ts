// Every photo is turned into a modest JPEG on the device before it goes
// anywhere. iPhone photos are HEIC, which only Safari can show, and run to
// several MB — too much for the storage server, which times out on them. A
// JPEG no wider than MAX_EDGE displays everywhere and uploads in a moment.

const MAX_EDGE = 2048;
const QUALITY = 0.85;
// A JPEG this small that's already within MAX_EDGE goes up untouched.
const PASS_THROUGH_BYTES = 1_500_000;
// GIFs keep their animation when they're a sensible size.
const MAX_GIF_BYTES = 8_000_000;

const UNREADABLE = "That photo couldn't be opened — try a different one.";

function looksLikeHeic(file: File): boolean {
  return /hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name);
}

async function decode(file: File): Promise<ImageBitmap> {
  try {
    // Safari reads HEIC itself; every browser reads JPEG/PNG/WebP/GIF/AVIF.
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    if (!looksLikeHeic(file)) throw new Error(UNREADABLE);
  }
  try {
    // Chrome, Firefox and Edge can't, so bring in a decoder — only then,
    // because it's ~3MB.
    const { heicTo } = await import("heic-to/next");
    return await heicTo({ blob: file, type: "bitmap", options: { imageOrientation: "from-image" } });
  } catch {
    throw new Error(UNREADABLE);
  }
}

export async function preparePhoto(file: File): Promise<File> {
  if (file.type === "image/gif" && file.size <= MAX_GIF_BYTES) return file;

  const bitmap = await decode(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  if (file.type === "image/jpeg" && scale === 1 && file.size <= PASS_THROUGH_BYTES) {
    bitmap.close();
    return file;
  }

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error(UNREADABLE);
  // JPEG has no transparency — give see-through PNGs a white backing, not black.
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", QUALITY));
  if (!blob) throw new Error(UNREADABLE);
  const name = `${file.name.replace(/\.[^.]*$/, "") || "photo"}.jpg`;
  return new File([blob], name, { type: "image/jpeg" });
}
