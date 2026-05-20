import type { SlideDefinition, WalkthroughDefinition } from './manifest';

const KEISHA = 'A friendly young Caribbean woman with warm brown skin, short natural hair, wearing a bright red SuperPlus apron over a white t-shirt, with a warm smile and expressive eyes';
const STYLE = 'modern flat vector illustration, clean lines, warm palette, no text, no words, no letters';
const BRAND = 'brand colors red #E31837 and navy #1B2A4A';

export const V1_SLIDES: SlideDefinition[] = [
  {
    id: 'welcome',
    heading: 'Welcome!',
    subtext: 'Your new work app',
    icon: 'waving_hand',
    color: '#E31837',
    imagePrompt: `${KEISHA}, waving at the viewer in front of a colorful Caribbean grocery store, ${STYLE}, ${BRAND}, 1024x1024`,
    narrationScript: "Hey! I'm Keisha. Welcome to SuperPlus Hub — this is your new app for work. Let me show you around.",
  },
  {
    id: 'tasks',
    heading: 'Tasks',
    subtext: 'See what needs doing',
    icon: 'assignment',
    color: '#446185',
    imagePrompt: `${KEISHA}, happily checking off items on a large clipboard with green checkmarks in a grocery store, ${STYLE}, blue accents #446185, 1024x1024`,
    narrationScript: "This is Tasks. When your manager gives you something to do, it shows up here. Tap to see it, mark it done when you're finished.",
  },
  {
    id: 'threads',
    heading: 'Threads',
    subtext: 'Talk to your team',
    icon: 'forum',
    color: '#2e7d32',
    imagePrompt: `${KEISHA}, chatting with a coworker with colorful speech bubbles between them in a store, ${STYLE}, green accents #2e7d32, 1024x1024`,
    narrationScript: "This is Threads — like a group chat for your store. Ask questions, share updates. No more missed messages.",
  },
  {
    id: 'logbook',
    heading: 'Logbook',
    subtext: 'Write what happened',
    icon: 'history',
    color: '#845500',
    imagePrompt: `${KEISHA}, writing notes in a large open logbook at a store counter with a clock showing shift change time behind her, ${STYLE}, amber and brown tones #845500, 1024x1024`,
    narrationScript: "The Logbook is where you write down what happened on your shift. Anything the next person needs to know goes here.",
  },
  {
    id: 'tools',
    heading: 'Tools',
    subtext: 'Calculator and more',
    icon: 'build',
    color: '#673ab7',
    imagePrompt: `${KEISHA}, surrounded by a calculator, price tags, and a clipboard floating around her, pointing at the tools, ${STYLE}, purple accents #673ab7, 1024x1024`,
    narrationScript: "These are your Tools — a calculator, product lookup, and other things to make your job easier.",
  },
  {
    id: 'ready',
    heading: 'Ready!',
    subtext: "You're all set",
    icon: 'celebration',
    color: '#E31837',
    imagePrompt: `${KEISHA}, jumping with joy surrounded by confetti and celebration elements, ${STYLE}, ${BRAND}, celebratory mood, 1024x1024`,
    narrationScript: "That's it! You're all set. If you ever need to see this again, go to your Profile. Let's get started!",
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
