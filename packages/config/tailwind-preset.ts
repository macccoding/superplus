import type { Config } from 'tailwindcss';

const preset: Partial<Config> = {
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#E31837',
          secondary: '#1B3A5C',
          accent: '#F5A623',
        },
        success: '#2ECC71',
        warning: '#F39C12',
        danger: '#E74C3C',
        surface: '#FFFFFF',
        background: '#F8F9FA',
        'text-primary': '#1A1A2E',
        'text-secondary': '#6B7280',
      },
      borderRadius: {
        card: '12px',
        button: '8px',
        input: '6px',
      },
      fontFamily: {
        heading: ['Inter', 'system-ui', 'sans-serif'],
        body: [
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
      },
    },
  },
};

export default preset;
