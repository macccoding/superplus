export interface SlideDefinition {
  id: string;
  heading: string;
  subtext: string;
  icon: string;
  color: string;
  imagePrompt: string;
  narrationScript: string;
}

export interface WalkthroughDefinition {
  id: string;
  target: string;
  tooltip: string;
  narrationScript: string;
}

export interface OnboardingManifest {
  version: number;
  type: 'orientation' | 'whats-new';
  title: string;
  generatedAt: string;
  slides: Array<{
    id: string;
    heading: string;
    subtext: string;
    icon: string;
    color: string;
    imageUrl: string;
    audioUrl: string;
    narrationScript: string;
  }>;
  walkthrough?: Array<{
    id: string;
    target: string;
    tooltip: string;
    audioUrl: string;
  }>;
}
