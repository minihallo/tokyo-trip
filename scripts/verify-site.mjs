import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const dataFile = path.join(PROJECT_ROOT, "data", "albums.js");
const dataSource = await fs.readFile(dataFile, "utf8");
const payload = JSON.parse(dataSource.replace(/^window\.TOKYO_TRIP\s*=\s*/, "").replace(/;\s*$/, ""));

const missing = [];

async function exists(relativePath) {
  try {
    await fs.access(path.join(PROJECT_ROOT, relativePath));
    return true;
  } catch {
    return false;
  }
}

for (const album of payload.albums) {
  if (!(await exists(`albums/${album.slug}/index.html`))) {
    missing.push(`albums/${album.slug}/index.html`);
  }

  for (const photo of album.photos) {
    if (!(await exists(photo.src.replace(/^\//, "")))) {
      missing.push(photo.src);
    }

    if (!(await exists(photo.thumb.replace(/^\//, "")))) {
      missing.push(photo.thumb);
    }
  }
}

if (missing.length > 0) {
  console.error("Missing generated files:");
  for (const file of missing) {
    console.error(`- ${file}`);
  }
  process.exit(1);
}

console.log(`Verified ${payload.totalAlbums} albums and ${payload.totalPhotos} photos.`);
