/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: 'var(--color-canvas)',
        parchment: 'var(--color-parchment)',
        surface: 'var(--color-surface)',
        ink: 'var(--color-ink)',
        muted: 'var(--color-muted)',
        faint: 'var(--color-faint)',
        accent: 'var(--color-accent)',
        'accent-focus': 'var(--color-accent-focus)',
        danger: 'var(--color-danger)',
        'accent-btn': 'var(--color-accent-btn)',
        hairline: 'var(--color-hairline)',
        divider: 'var(--color-divider)',
        nav: 'var(--color-nav)',
        'on-accent': 'var(--color-on-accent)',
        'on-nav': 'var(--color-on-nav)',
      },
      fontFamily: {
        sans: ['-apple-system', 'system-ui', '"SF Pro Text"', '"SF Pro Display"', 'Inter', 'sans-serif'],
      },
      borderRadius: { none: '0', xs: '5px', sm: '8px', md: '11px', lg: '18px', pill: '9999px' },
    },
  },
  plugins: [],
};
