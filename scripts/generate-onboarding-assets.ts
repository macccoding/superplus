import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import { generateImages } from './onboarding/generate-images';
import { generateAudio } from './onboarding/generate-audio';
import { V1_SLIDES, V1_WALKTHROUGH } from './onboarding/slides';
import type { OnboardingManifest } from './onboarding/manifest';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env') });

const version = parseInt(process.argv.find((a) => a.startsWith('--version='))?.split('=')[1] ?? '1');

async function main() {
  console.log(`\nGenerating onboarding assets v${version}\n`);

  const slides = version === 1 ? V1_SLIDES : V1_SLIDES; // extend for future versions
  const walkthrough = version === 1 ? V1_WALKTHROUGH : undefined;

  // Generate images
  console.log('Generating images...');
  const imageUrls = await generateImages(slides, version);

  // Generate slide audio
  console.log('\nGenerating slide audio...');
  const slideAudioItems = slides.map((s) => ({ id: s.id, script: s.narrationScript }));
  const slideAudioUrls = await generateAudio(slideAudioItems, version);

  // Generate walkthrough audio
  let walkthroughAudioUrls = new Map<string, string>();
  if (walkthrough) {
    console.log('\nGenerating walkthrough audio...');
    const wtAudioItems = walkthrough.map((w) => ({ id: w.id, script: w.narrationScript }));
    walkthroughAudioUrls = await generateAudio(wtAudioItems, version);
  }

  // Build manifest
  const manifest: OnboardingManifest = {
    version,
    type: version === 1 ? 'orientation' : 'whats-new',
    title: version === 1 ? 'Welcome to SuperPlus Hub!' : "What's New!",
    generatedAt: new Date().toISOString(),
    slides: slides.map((s) => ({
      id: s.id,
      heading: s.heading,
      subtext: s.subtext,
      icon: s.icon,
      color: s.color,
      imageUrl: imageUrls.get(s.id) ?? '',
      audioUrl: slideAudioUrls.get(s.id) ?? '',
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
  console.log(`  Total cost: ~$${((slides.length * 0.04) + ((slides.length + (walkthrough?.length ?? 0)) * 0.015)).toFixed(2)}`);
}

main().catch((e) => {
  console.error('Asset generation failed:', e);
  process.exit(1);
});
