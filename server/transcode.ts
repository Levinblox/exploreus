import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { BUCKET, getClient } from "./r2.js";
import { pool } from "./db.js";

// Re-encodes uploaded video to 1080p H.264 ~3 Mbps, uploads the result to R2
// with a new key, deletes the original, and rewrites the media row.
//
// Runs fire-and-forget after a media row is inserted. The original (large)
// video remains playable in the meantime; once this finishes, the row points
// at the optimized version.
export async function transcodeVideoInBackground(
  mediaId: string,
  originalKey: string,
  opts: { posterTime?: number } = {}
): Promise<void> {
  let workDir: string | null = null;
  try {
    workDir = await mkdtemp(join(tmpdir(), "trans-"));
    const inputPath = join(workDir, "input");
    const outputPath = join(workDir, "output.mp4");
    const thumbPath = join(workDir, "thumb.jpg");

    // 1. Download original from R2.
    const s3 = getClient();
    const obj = await s3.send(
      new GetObjectCommand({ Bucket: BUCKET, Key: originalKey })
    );
    const body = obj.Body as { transformToByteArray: () => Promise<Uint8Array> } | undefined;
    if (!body) throw new Error("R2 returned empty body");
    const bytes = await body.transformToByteArray();
    await writeFile(inputPath, bytes);

    // 2. Transcode with ffmpeg.
    //    -vf scale: cap longest edge at 1080, keep aspect, ensure even dims
    //    -c:v libx264 -crf 23 -preset veryfast: good quality, fast encode
    //    -c:a aac -b:a 128k: standard audio
    //    -movflags +faststart: enable progressive streaming
    await runFfmpeg([
      "-y",
      "-i", inputPath,
      "-vf", "scale='if(gt(iw,ih),min(1080,iw),-2)':'if(gt(iw,ih),-2,min(1080,ih))'",
      "-c:v", "libx264",
      "-crf", "23",
      "-preset", "veryfast",
      "-c:a", "aac",
      "-b:a", "128k",
      "-movflags", "+faststart",
      outputPath,
    ]);

    // 3. Cut the poster frame at the timestamp the user picked (default ~1s,
    //    which avoids the usually-black first frame). Best-effort: a thumbnail
    //    failure must not lose the transcode result.
    const newKey = originalKey.replace(/\.[^.]+$/, "") + ".mp4";
    const thumbKey = newKey.replace(/\.[^.]+$/, "") + "_thumb.jpg";
    const posterAt = Number.isFinite(opts.posterTime) ? Math.max(0, opts.posterTime!) : 1;
    let haveThumb = false;
    try {
      await runFfmpeg([
        "-y",
        "-ss", String(posterAt),
        "-i", outputPath,
        "-frames:v", "1",
        "-vf", "scale='if(gt(iw,ih),min(640,iw),-2)':'if(gt(iw,ih),-2,min(640,ih))'",
        "-q:v", "3",
        thumbPath,
      ]);
      await s3.send(
        new PutObjectCommand({
          Bucket: BUCKET,
          Key: thumbKey,
          Body: await readFile(thumbPath),
          ContentType: "image/jpeg",
        })
      );
      haveThumb = true;
    } catch (e) {
      console.warn("thumbnail generation failed", mediaId, e);
    }

    // 4. Upload optimized version with a new key.
    const optimized = await readFile(outputPath);
    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: newKey,
        Body: optimized,
        ContentType: "video/mp4",
      })
    );

    // 5. Delete the original if the key actually changed.
    if (newKey !== originalKey) {
      await s3
        .send(new DeleteObjectCommand({ Bucket: BUCKET, Key: originalKey }))
        .catch((e) => console.warn("orig delete failed", e));
    }

    // 6. Update DB row.
    await pool.query(
      `UPDATE media SET storage_key = $1, content_type = 'video/mp4', size_bytes = $2,
                        thumb_key = $3
         WHERE id = $4`,
      [newKey, optimized.length, haveThumb ? thumbKey : null, mediaId]
    );

    console.log(
      `transcoded ${mediaId}: ${bytes.length} -> ${optimized.length} bytes (${Math.round((1 - optimized.length / bytes.length) * 100)}% smaller)`
    );
  } catch (e) {
    console.error("transcode failed", mediaId, e);
  } finally {
    if (workDir) await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const ff = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    ff.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      // Keep the buffer bounded.
      if (stderr.length > 50_000) stderr = stderr.slice(-50_000);
    });
    ff.on("error", reject);
    ff.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-2000)}`));
    });
  });
}

// Re-cut a video's poster at `time` seconds and upload it under a fresh key
// (fresh so the CDN serves the new image immediately). Returns the new key.
// Used when the user picks a cover from the already-transcoded H.264 video.
export async function generatePosterAt(videoKey: string, time: number): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "cover-"));
  try {
    const s3 = getClient();
    const obj = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: videoKey }));
    const body = obj.Body as { transformToByteArray: () => Promise<Uint8Array> } | undefined;
    if (!body) throw new Error("R2 returned empty body");
    const inputPath = join(dir, "in.mp4");
    const outPath = join(dir, "cover.jpg");
    await writeFile(inputPath, await body.transformToByteArray());

    const at = Number.isFinite(time) ? Math.max(0, time) : 1;
    await runFfmpeg([
      "-y",
      "-ss", String(at),
      "-i", inputPath,
      "-frames:v", "1",
      "-vf", "scale='if(gt(iw,ih),min(640,iw),-2)':'if(gt(iw,ih),-2,min(640,ih))'",
      "-q:v", "3",
      outPath,
    ]);

    const key =
      videoKey.replace(/\.[^.]+$/, "") + "_cover_" + Math.random().toString(36).slice(2, 8) + ".jpg";
    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: await readFile(outPath),
        ContentType: "image/jpeg",
      })
    );
    return key;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
