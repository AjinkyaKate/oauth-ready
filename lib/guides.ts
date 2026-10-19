import fs from "node:fs/promises";
import path from "node:path";
import { put, list } from "@vercel/blob";
import { Guide } from "./schema";

const CURATED_DIR = path.join(process.cwd(), "data", "guides");
const LOCAL_GENERATED_DIR = path.join(process.cwd(), "data", "generated");
// On Vercel the filesystem is read-only, so generated guides go to Vercel Blob when a token is set.
const blobEnabled = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);

async function readDir(dir: string): Promise<Guide[]> {
  try {
    const files = (await fs.readdir(dir)).filter((f) => f.endsWith(".json"));
    const out: Guide[] = [];
    for (const f of files) {
      const parsed = Guide.safeParse(JSON.parse(await fs.readFile(path.join(dir, f), "utf8")));
      if (parsed.success) out.push(parsed.data);
      else console.warn(`Skipping invalid guide ${f}:`, parsed.error.issues.slice(0, 3));
    }
    return out;
  } catch {
    return [];
  }
}

export async function curatedGuides(): Promise<Guide[]> {
  return readDir(CURATED_DIR);
}

export async function generatedGuides(): Promise<Guide[]> {
  if (!blobEnabled()) return readDir(LOCAL_GENERATED_DIR);
  const { blobs } = await list({ prefix: "guides/" });
  const out: Guide[] = [];
  for (const b of blobs) {
    const parsed = Guide.safeParse(await (await fetch(b.url, { cache: "no-store" })).json());
    if (parsed.success) out.push(parsed.data);
  }
  return out;
}

export async function allGuides(): Promise<Guide[]> {
  const [curated, generated] = await Promise.all([curatedGuides(), generatedGuides()]);
  const seen = new Set(curated.map((g) => g.slug));
  return [...curated, ...generated.filter((g) => !seen.has(g.slug))];
}

export async function getGuide(slug: string): Promise<Guide | undefined> {
  return (await allGuides()).find((g) => g.slug === slug);
}

export async function saveGenerated(guide: Guide): Promise<void> {
  const body = JSON.stringify(guide, null, 2);
  if (blobEnabled()) {
    await put(`guides/${guide.slug}.json`, body, {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    return;
  }
  await fs.mkdir(LOCAL_GENERATED_DIR, { recursive: true });
  await fs.writeFile(path.join(LOCAL_GENERATED_DIR, `${guide.slug}.json`), body);
}
