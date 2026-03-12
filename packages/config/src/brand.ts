export const brand = {
  colors: {
    primary: '#E31837',
    secondary: '#1B3A5C',
    accent: '#F5A623',
    success: '#2ECC71',
    warning: '#F39C12',
    danger: '#E74C3C',
    background: '#F8F9FA',
    surface: '#FFFFFF',
    textPrimary: '#1A1A2E',
    textSecondary: '#6B7280',
  },
  radius: {
    card: '12px',
    button: '8px',
    input: '6px',
  },
  fonts: {
    heading: 'Inter, system-ui, sans-serif',
    body: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
} as const;

export type BrandColors = typeof brand.colors;
