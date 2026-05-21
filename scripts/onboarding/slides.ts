import type { SlideDefinition, WalkthroughDefinition } from './manifest';

const TANYA = 'A friendly young Caribbean woman with warm brown skin and short natural hair, wearing a bright red grocery store apron over a white t-shirt';
const STYLE = 'modern flat vector illustration, clean lines, warm palette, no text, no words, no letters';
const BRAND = 'brand colors red #E31837 and navy #1B2A4A';

const TANYA_VIDEO = 'A friendly young Caribbean woman with warm brown skin and short natural hair, wearing a bright red grocery store apron over a white t-shirt, standing in a bright, colorful Caribbean grocery store';

export const V1_SLIDES: SlideDefinition[] = [
  {
    id: 'welcome',
    heading: 'Welcome!',
    subtext: 'Your new work app',
    icon: 'waving_hand',
    color: '#E31837',
    imagePrompt: `${TANYA}, waving at the viewer in front of a colorful Caribbean grocery store, ${STYLE}, ${BRAND}, 1024x1024`,
    videoPrompt: `${TANYA_VIDEO}. She looks directly at the camera with a warm smile and waves. She says: "Hey! I'm Tanya. Welcome to SuperPlus — this is your new app for work. Let me show you around." Medium shot, natural warm lighting, friendly and inviting. Cinematic quality, shallow depth of field.`,
    videoDuration: 8,
    narrationScript: "Hey! I'm Tanya. Welcome to SuperPlus — this is your new app for work. Let me show you around.",
  },
  {
    id: 'tour',
    heading: '',
    subtext: '',
    icon: 'school',
    color: '#E31837',
    imagePrompt: `${TANYA}, giving a tour of a grocery store, gesturing at shelves and tools, ${STYLE}, ${BRAND}, 1024x1024`,
    videoPrompt: `${TANYA_VIDEO}. Continuous single take, medium shot. She speaks directly to the camera in a warm, conversational tone, gesturing naturally as she explains each feature. She says: "Let me show you what's inside. Tasks is where you see what needs doing — your manager puts things here and you mark them done. Threads is your group chat — ask questions, share updates, no more missed messages. The Logbook is where you write what happened on your shift, so the next person knows. And Tools has your calculator, product lookup, and more. That's it! You're all set. If you ever need to see this again, just check your Profile. Let's get started!" She finishes with a big smile and a thumbs up. Natural lighting, cinematic quality, shallow depth of field, grocery store background with colorful produce.`,
    videoDuration: 20,
    narrationScript: "Let me show you what's inside. Tasks is where you see what needs doing. Threads is your group chat. The Logbook is where you write what happened on shift. And Tools has your calculator and more. That's it! You're all set.",
  },
];

export const V1_WALKTHROUGH: WalkthroughDefinition[] = [
  {
    id: 'wt-tasks',
    target: 'tasks',
    tooltip: 'Your tasks are here',
    narrationScript: 'Tap this whenever you need to see what\'s assigned to you.',
  },
  {
    id: 'wt-threads',
    target: 'threads',
    tooltip: 'Chat with your team',
    narrationScript: 'Tap here to talk to your team or read what\'s going on.',
  },
  {
    id: 'wt-logbook',
    target: 'logbook',
    tooltip: 'Write your shift notes',
    narrationScript: 'Before you leave, tap here and write what happened.',
  },
  {
    id: 'wt-tools',
    target: 'tools',
    tooltip: 'Calculator and more',
    narrationScript: 'Need to do a quick calculation? It\'s right here.',
  },
];
