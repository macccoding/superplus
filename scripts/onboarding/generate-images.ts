import OpenAI from 'openai';
import { put } from '@vercel/blob';
import type { SlideDefinition } from './manifest';

export async function generateImages(
  slides: SlideDefinition[],
  version: number,
): Promise<Map<string, string>> {
  const openai = new OpenAI();
  const urls = new Map<string, string>();

  for (const slide of slides) {
    console.log(`  Generating image: ${slide.id}...`);
    const response = await openai.images.generate({
      model: 'gpt-image-1',
      prompt: slide.imagePrompt,
      size: '1024x1024',
      quality: 'high',
      n: 1,
    });

    const item = response.data[0];
    if (!item) throw new Error(`No image generated for ${slide.id}`);

    // gpt-image-1 returns b64_json by default, fall back to URL download
    let buffer: Buffer;
    if ('b64_json' in item && item.b64_json) {
      buffer = Buffer.from(item.b64_json, 'base64');
    } else if ('url' in item && item.url) {
      const imageResponse = await fetch(item.url);
      buffer = Buffer.from(await imageResponse.arrayBuffer());
    } else {
      throw new Error(`No image data for ${slide.id}`);
    }

    const blob = await put(`onboarding/v${version}/${slide.id}.png`, buffer, {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'image/png',
    });

    urls.set(slide.id, blob.url);
    console.log(`  ✓ ${slide.id} → ${blob.url}`);
  }

  return urls;
}
