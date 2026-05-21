import OpenAI from 'openai';
import { put } from '@vercel/blob';
import type { SlideDefinition } from './manifest';

export async function generateVideos(
  slides: SlideDefinition[],
  version: number,
): Promise<Map<string, string>> {
  const openai = new OpenAI();
  const urls = new Map<string, string>();

  for (const slide of slides) {
    if (!slide.videoPrompt) continue;

    console.log(`  Generating video: ${slide.id} (${slide.videoDuration ?? 8}s)...`);

    // Create video generation job
    const response = await openai.videos.create({
      model: 'sora-2-pro',
      prompt: slide.videoPrompt,
      size: '1080x1920',
      seconds: slide.videoDuration ?? 8,
    } as any);

    const videoId = (response as any).id;
    if (!videoId) throw new Error(`No video job ID for ${slide.id}`);
    console.log(`    Job ${videoId} started, polling...`);

    // Poll for completion — up to 20 minutes (Sora Pro can be slow)
    let completed = false;
    for (let i = 0; i < 120; i++) {
      await new Promise((r) => setTimeout(r, 10000));
      const status = await openai.videos.retrieve(videoId) as any;

      if (status.status === 'completed') {
        completed = true;
        break;
      } else if (status.status === 'failed') {
        throw new Error(`Video failed for ${slide.id}: ${status.error || 'unknown'}`);
      }

      const elapsed = (i + 1) * 10;
      if (elapsed % 60 === 0) console.log(`    Still generating... (${elapsed}s)`);
    }

    if (!completed) throw new Error(`Video timed out for ${slide.id} (20 minutes)`);

    // Download via /videos/{id}/content endpoint
    console.log(`    Downloading MP4...`);
    const contentResponse = await fetch(`https://api.openai.com/v1/videos/${videoId}/content`, {
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    });
    if (!contentResponse.ok) {
      throw new Error(`Failed to download video ${slide.id}: ${contentResponse.status} ${contentResponse.statusText}`);
    }
    const buffer = Buffer.from(await contentResponse.arrayBuffer());
    console.log(`    Downloaded ${(buffer.length / 1024 / 1024).toFixed(1)}MB`);

    // Upload to Vercel Blob
    const blob = await put(`onboarding/v${version}/${slide.id}.mp4`, buffer, {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'video/mp4',
    });

    urls.set(slide.id, blob.url);
    console.log(`  ✓ ${slide.id} → ${blob.url}`);
  }

  return urls;
}
