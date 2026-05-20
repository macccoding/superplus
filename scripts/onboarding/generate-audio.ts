import OpenAI from 'openai';
import { put } from '@vercel/blob';

const VOICE_INSTRUCTIONS = `You are Keisha, a warm and friendly Caribbean grocery store worker giving a tour to a new coworker.
Speak with a warm, relaxed tone. Natural and conversational — like you're talking to someone right next to you, not reading from a script.
Pace should be steady and unhurried. Approachable and encouraging. You genuinely want to help.`;

interface AudioItem {
  id: string;
  script: string;
}

export async function generateAudio(
  items: AudioItem[],
  version: number,
): Promise<Map<string, string>> {
  const openai = new OpenAI();
  const urls = new Map<string, string>();

  for (const item of items) {
    console.log(`  Generating audio: ${item.id}...`);
    const response = await openai.audio.speech.create({
      model: 'gpt-4o-mini-tts',
      voice: 'coral',
      input: item.script,
      instructions: VOICE_INSTRUCTIONS,
      response_format: 'mp3',
    });

    const buffer = Buffer.from(await response.arrayBuffer());

    const blob = await put(`onboarding/v${version}/${item.id}.mp3`, buffer, {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'audio/mpeg',
    });

    urls.set(item.id, blob.url);
    console.log(`  ✓ ${item.id} → ${blob.url}`);
  }

  return urls;
}
