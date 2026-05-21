import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import { generateImages } from './onboarding/generate-images';
import { generateVideos } from './onboarding/generate-videos';
import { generateAudio } from './onboarding/generate-audio';
import { V1_SLIDES, V1_WALKTHROUGH } from './onboarding/slides';
import type { OnboardingManifest } from './onboarding/manifest';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env') });

const version = parseInt(process.argv.find((a) => a.startsWith('--version='))?.split('=')[1] ?? '1');
const skipImages = process.argv.includes('--skip-images');
const skipVideos = process.argv.includes('--skip-videos');
const skipAudio = process.argv.includes('--skip-audio');

async function main() {
  console.log(`\nGenerating onboarding assets v${version}\n`);

  const slides = version === 1 ? V1_SLIDES : V1_SLIDES;
  const walkthrough = version === 1 ? V1_WALKTHROUGH : undefined;

  // Generate images (fallback for when video can't play)
  let imageUrls = new Map<string, string>();
  if (!skipImages) {
    console.log('Generating images...');
    imageUrls = await generateImages(slides, version);
  }

  // Generate videos (primary — Sora 2 Pro with native audio)
  let videoUrls = new Map<string, string>();
  if (!skipVideos) {
    console.log('\nGenerating videos (Sora 2 Pro)...');
    console.log('  This takes a few minutes per video — be patient.\n');
    videoUrls = await generateVideos(slides, version);
  }

  // Generate walkthrough audio (TTS — still needed for spotlight tooltips)
  let walkthroughAudioUrls = new Map<string, string>();
  if (!skipAudio && walkthrough) {
    console.log('\nGenerating walkthrough audio...');
    const wtAudioItems = walkthrough.map((w) => ({ id: w.id, script: w.narrationScript }));
    walkthroughAudioUrls = await generateAudio(wtAudioItems, version);
  }

  // Build manifest
  const manifest: OnboardingManifest = {
    version,
    type: version === 1 ? 'orientation' : 'whats-new',
    title: version === 1 ? 'Welcome to SuperPlus!' : "What's New!",
    generatedAt: new Date().toISOString(),
    slides: slides.map((s) => ({
      id: s.id,
      heading: s.heading,
      subtext: s.subtext,
      icon: s.icon,
      color: s.color,
      imageUrl: imageUrls.get(s.id) ?? '',
      videoUrl: videoUrls.get(s.id) ?? '',
      audioUrl: '', // Audio is baked into video now, TTS only for walkthrough
      narrationScript: s.narrationScript,
    })),
    walkthrough: walkthrough?.map((w) => ({
      id: w.id,
      target: w.target,
      tooltip: w.tooltip,
      audioUrl: walkthroughAudioUrls.get(w.id) ?? '',
    })),
  };

  // Write manifest
  const manifestPath = resolve(__dirname, `../apps/web/src/data/onboarding-v${version}.json`);
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`\n✓ Manifest written to ${manifestPath}`);
  console.log(`  ${slides.length} slides, ${walkthrough?.length ?? 0} walkthrough steps`);
  console.log(`  Videos: ${videoUrls.size}, Images: ${imageUrls.size}`);
}

main().catch((e) => {
  console.error('Asset generation failed:', e);
  process.exit(1);
});
