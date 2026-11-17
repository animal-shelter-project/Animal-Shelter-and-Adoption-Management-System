const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const HttpError = require("./HttpError");
const { UPLOAD_DIR } = require("../config");

// Uploaded pictures: animal photos, profile pictures and home photos on
// adoption applications. The browser sends each one as a data: URL; it is
// checked here and saved as a file in the uploads folder.

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

// Accepted types, recognised by their first bytes (not by what the browser
// claims), so only real images are ever saved.
const IMAGE_TYPES = [
  { ext: "jpg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: "png", test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { ext: "webp", test: (b) => b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP" },
];

const fieldError = (field, message) => new HttpError(400, message, { fields: { [field]: message } });

// "data:image/jpeg;base64,..." -> { bytes, ext }, or a 400 naming `field`.
function readImage(dataUrl, field = "photo") {
  const match = typeof dataUrl === "string" && /^data:image\/[a-z+]+;base64,([A-Za-z0-9+/=\s]+)$/.exec(dataUrl);
  if (!match) throw fieldError(field, "Choose a JPEG, PNG or WebP photo.");
  const bytes = Buffer.from(match[1], "base64");
  if (bytes.length === 0) throw fieldError(field, "That file is empty.");
  if (bytes.length > MAX_IMAGE_BYTES) throw fieldError(field, "Photos must be 2 MB or smaller.");
  const type = IMAGE_TYPES.find((t) => t.test(bytes));
  if (!type) throw fieldError(field, "Choose a JPEG, PNG or WebP photo.");
  return { bytes, ext: type.ext };
}

// A file name nobody can guess, e.g. "user-3-9f2c41a07be1d3e5.jpg".
function newFileName(prefix, ext) {
  return `${prefix}-${crypto.randomBytes(8).toString("hex")}.${ext}`;
}

function writeImage(fileName, bytes) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  fs.writeFileSync(path.join(UPLOAD_DIR, path.basename(fileName)), bytes);
}

// Check, then save; returns the new file name.
function saveImage(prefix, dataUrl, field) {
  const { bytes, ext } = readImage(dataUrl, field);
  const fileName = newFileName(prefix, ext);
  writeImage(fileName, bytes);
  return fileName;
}

function removeImage(fileName) {
  if (!fileName) return;
  try {
    fs.unlinkSync(path.join(UPLOAD_DIR, path.basename(fileName)));
  } catch {
    // already gone: nothing to do
  }
}

const imageUrl = (fileName) => (fileName ? `/uploads/${fileName}` : null);

module.exports = { MAX_IMAGE_BYTES, readImage, newFileName, writeImage, saveImage, removeImage, imageUrl };
