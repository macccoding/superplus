import type { Config } from 'tailwindcss';
import preset from '@superplus/config/tailwind';

const config: Config = {
  presets: [preset],
  content: [
    './src/**/*.{js,ts,jsx,tsx}',
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: { extend: {} },
  plugins: [],
};

export default config;
