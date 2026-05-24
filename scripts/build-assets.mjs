import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE_DIR = process.env.TOKYO_SOURCE_DIR || "/Users/user/Documents/일본";
const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const FULL_MAX = Number(process.env.TOKYO_FULL_MAX || 1800);
const THUMB_MAX = Number(process.env.TOKYO_THUMB_MAX || 640);
const FULL_QUALITY = Number(process.env.TOKYO_FULL_QUALITY || 78);
const THUMB_QUALITY = Number(process.env.TOKYO_THUMB_QUALITY || 72);

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".heic", ".webp"]);
const VIDEO_EXTENSIONS = new Set([".mp4", ".mov", ".m4v"]);

const ALBUM_CONFIG = {
  "시부야": {
    slug: "shibuya",
    order: 1,
    title: "시부야",
    subtitle: "첫날 저녁의 고층 빛과 교차로",
  },
  "베이스캠프도쿄": {
    slug: "basecamp-tokyo",
    order: 2,
    title: "베이스캠프 도쿄",
    subtitle: "여행의 기준점이 된 숙소 주변",
  },
  "메이지신궁": {
    slug: "meiji-jingu",
    order: 3,
    title: "메이지신궁",
    subtitle: "숲길과 신궁의 낮은 공기",
  },
  "신주쿠교엔": {
    slug: "shinjuku-gyoen",
    order: 4,
    title: "신주쿠교엔",
    subtitle: "정원, 잔디, 도심 안의 넓은 숨",
  },
  "메구로 스시": {
    slug: "meguro-sushi",
    order: 5,
    title: "메구로 스시",
    subtitle: "늦은 오후의 한 끼",
  },
  "에미스": {
    slug: "emis",
    order: 6,
    title: "에미스",
    subtitle: "짧게 남긴 쇼핑 스팟",
  },
  "에도도쿄박물관": {
    slug: "edo-tokyo-museum",
    order: 7,
    title: "에도도쿄박물관",
    subtitle: "도시의 오래된 시간감",
  },
  "아키하바라": {
    slug: "akihabara",
    order: 8,
    title: "아키하바라",
    subtitle: "전광판과 골목의 밀도",
  },
};

function runSips(args) {
  execFileSync("sips", args, { stdio: ["ignore", "pipe", "pipe"] });
}

function readDimensions(filePath) {
  const output = execFileSync(
    "sips",
    ["-g", "pixelWidth", "-g", "pixelHeight", filePath],
    { encoding: "utf8" },
  );
  const width = Number(output.match(/pixelWidth:\s+(\d+)/)?.[1]);
  const height = Number(output.match(/pixelHeight:\s+(\d+)/)?.[1]);

  if (!width || !height) {
    throw new Error(`Unable to read dimensions for ${filePath}`);
  }

  return { width, height };
}

function scaledDimensions({ width, height }, maxSide) {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  };
}

function normalizeAlbumName(name) {
  return name.normalize("NFC");
}

function fallbackSlug(name, index) {
  const ascii = name
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  return ascii || `album-${String(index + 1).padStart(2, "0")}`;
}

function safeFileStem(name) {
  return name
    .normalize("NFKD")
    .toLowerCase()
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function captureInfo(fileName) {
  const match = fileName.match(/DJI_(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/i);

  if (!match) {
    return null;
  }

  const [, year, month, day, hour, minute, second] = match;

  return {
    iso: `${year}-${month}-${day}T${hour}:${minute}:${second}`,
    date: `${year}.${month}.${day}`,
    time: `${hour}:${minute}`,
  };
}

function formatDateRange(items) {
  const dates = [...new Set(items.map((item) => item.date).filter(Boolean))];

  if (dates.length === 0) {
    return "";
  }

  if (dates.length === 1) {
    return dates[0];
  }

  return `${dates[0]} - ${dates[dates.length - 1]}`;
}

function convertImage(source, destination, maxSide, quality) {
  runSips([
    "-s",
    "format",
    "jpeg",
    "-s",
    "formatOptions",
    String(quality),
    "--resampleHeightWidthMax",
    String(maxSide),
    source,
    "--out",
    destination,
  ]);
}

function pageTemplate() {
  return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="도쿄 여행 사진을 장소별 앨범으로 정리한 페이지" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Tokyo Trip" />
    <meta property="og:title" content="Tokyo Trip" />
    <meta property="og:description" content="도쿄 여행 사진을 장소별 앨범으로 정리한 페이지" />
    <meta property="og:image" content="/assets/og-image.jpg" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="Tokyo Trip" />
    <meta name="twitter:description" content="도쿄 여행 사진을 장소별 앨범으로 정리한 페이지" />
    <meta name="twitter:image" content="/assets/og-image.jpg" />
    <title>Tokyo Trip</title>
    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body>
    <div id="app"></div>
    <script src="/data/albums.js"></script>
    <script src="/app.js"></script>
  </body>
</html>
`;
}

async function resetGeneratedDirs() {
  await fs.rm(path.join(PROJECT_ROOT, "assets", "photos"), { recursive: true, force: true });
  await fs.rm(path.join(PROJECT_ROOT, "assets", "thumbs"), { recursive: true, force: true });
  await fs.rm(path.join(PROJECT_ROOT, "albums"), { recursive: true, force: true });
  await fs.mkdir(path.join(PROJECT_ROOT, "assets", "photos"), { recursive: true });
  await fs.mkdir(path.join(PROJECT_ROOT, "assets", "thumbs"), { recursive: true });
  await fs.mkdir(path.join(PROJECT_ROOT, "data"), { recursive: true });
}

async function collectAlbumFolders() {
  const entries = await fs.readdir(SOURCE_DIR, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry, index) => {
      const normalizedName = normalizeAlbumName(entry.name);
      const config = ALBUM_CONFIG[normalizedName] || {};

      return {
        sourceName: entry.name,
        normalizedName,
        sourcePath: path.join(SOURCE_DIR, entry.name),
        slug: config.slug || fallbackSlug(normalizedName, index),
        order: config.order || 100 + index,
        title: config.title || normalizedName,
        subtitle: config.subtitle || "도쿄에서 남긴 장면",
      };
    })
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, "ko"));
}

async function listFilesRecursive(directory, base = directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".")) {
      continue;
    }

    const absolutePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await listFilesRecursive(absolutePath, base)));
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const stats = await fs.stat(absolutePath);

    files.push({
      name: entry.name,
      path: absolutePath,
      relativePath: path.relative(base, absolutePath),
      size: stats.size,
    });
  }

  return files;
}

function dedupeByFileName(files) {
  const byName = new Map();

  for (const file of files) {
    const key = file.name.normalize("NFC").toLowerCase();
    const existing = byName.get(key);

    if (!existing || file.size > existing.size) {
      byName.set(key, file);
    }
  }

  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name, "en"));
}

async function buildAlbum(folder, albumIndex) {
  const files = await listFilesRecursive(folder.sourcePath);
  const imageFiles = dedupeByFileName(
    files.filter((file) => IMAGE_EXTENSIONS.has(path.extname(file.name).toLowerCase())),
  );
  const videoCount = files.filter((file) =>
    VIDEO_EXTENSIONS.has(path.extname(file.name).toLowerCase()),
  ).length;

  const fullDir = path.join(PROJECT_ROOT, "assets", "photos", folder.slug);
  const thumbDir = path.join(PROJECT_ROOT, "assets", "thumbs", folder.slug);
  await fs.mkdir(fullDir, { recursive: true });
  await fs.mkdir(thumbDir, { recursive: true });

  console.log(`[${albumIndex + 1}] ${folder.title}: ${imageFiles.length} photos`);

  const photos = [];

  for (let index = 0; index < imageFiles.length; index += 1) {
    const file = imageFiles[index];
    const fileName = file.name;
    const sourcePath = file.path;
    const stem = safeFileStem(fileName) || `photo-${index + 1}`;
    const outputName = `${String(index + 1).padStart(3, "0")}-${stem}.jpg`;
    const fullPath = path.join(fullDir, outputName);
    const thumbPath = path.join(thumbDir, outputName);
    const originalDimensions = readDimensions(sourcePath);
    const fullDimensions = scaledDimensions(originalDimensions, FULL_MAX);
    const thumbDimensions = scaledDimensions(originalDimensions, THUMB_MAX);
    const captured = captureInfo(fileName);

    convertImage(sourcePath, fullPath, FULL_MAX, FULL_QUALITY);
    convertImage(fullPath, thumbPath, THUMB_MAX, THUMB_QUALITY);

    photos.push({
      id: `${folder.slug}-${String(index + 1).padStart(3, "0")}`,
      src: `/assets/photos/${folder.slug}/${outputName}`,
      thumb: `/assets/thumbs/${folder.slug}/${outputName}`,
      width: fullDimensions.width,
      height: fullDimensions.height,
      thumbWidth: thumbDimensions.width,
      thumbHeight: thumbDimensions.height,
      capturedAt: captured?.iso || null,
      date: captured?.date || "",
      time: captured?.time || "",
      fileName,
      sourcePath: file.relativePath,
    });
  }

  const cover = photos[Math.floor(photos.length / 3)] || photos[0] || null;

  return {
    slug: folder.slug,
    order: folder.order,
    title: folder.title,
    subtitle: folder.subtitle,
    sourceFolder: folder.normalizedName,
    routeLabel: String(folder.order).padStart(2, "0"),
    dateRange: formatDateRange(photos),
    photoCount: photos.length,
    videoCount,
    cover: cover?.src || "",
    coverThumb: cover?.thumb || "",
    photos,
  };
}

async function writePages(albums) {
  const template = pageTemplate();
  await fs.writeFile(path.join(PROJECT_ROOT, "index.html"), template);

  for (const album of albums) {
    const albumDir = path.join(PROJECT_ROOT, "albums", album.slug);
    await fs.mkdir(albumDir, { recursive: true });
    await fs.writeFile(path.join(albumDir, "index.html"), template);
  }
}

async function main() {
  if (!existsSync(SOURCE_DIR)) {
    throw new Error(`Photo source folder does not exist: ${SOURCE_DIR}`);
  }

  await resetGeneratedDirs();
  const folders = await collectAlbumFolders();
  const albums = [];

  for (let index = 0; index < folders.length; index += 1) {
    albums.push(await buildAlbum(folders[index], index));
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    sourceDir: SOURCE_DIR,
    totalAlbums: albums.length,
    totalPhotos: albums.reduce((sum, album) => sum + album.photoCount, 0),
    totalVideosExcluded: albums.reduce((sum, album) => sum + album.videoCount, 0),
    albums,
  };

  await fs.writeFile(
    path.join(PROJECT_ROOT, "data", "albums.js"),
    `window.TOKYO_TRIP = ${JSON.stringify(payload, null, 2)};\n`,
  );

  await writePages(albums);

  console.log(`Built ${payload.totalAlbums} albums, ${payload.totalPhotos} photos.`);
  if (payload.totalVideosExcluded > 0) {
    console.log(`Skipped ${payload.totalVideosExcluded} video files.`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
