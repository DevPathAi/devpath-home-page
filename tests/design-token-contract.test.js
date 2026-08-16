import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (path) => readFileSync(
  fileURLToPath(new URL(`../${path}`, import.meta.url)),
  'utf-8',
);

const css = read('assets/tokens.css');
const design = read('DESIGN.md');

function declarations(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const block = css.match(new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\}`));
  expect(block, `${selector} token block`).not.toBeNull();
  return Object.fromEntries(
    [...block[1].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)]
      .map(([, name, value]) => [name, value.trim()]),
  );
}

const colors = {
  '--dp-color-primary': ['#B45309', '#F59E0B'],
  '--dp-color-primary-text': ['#92400E', '#FBBF24'],
  '--dp-color-primary-text-strong': ['#78350F', '#FCD34D'],
  '--dp-color-on-primary': ['#FFFFFF', '#1A1200'],
  '--dp-color-accent-soft': ['#FDF1E0', '#2E2007'],
  '--dp-color-accent-line': ['#F2D0A0', '#5C400E'],
  '--dp-color-bg': ['#FAF9F7', '#0F0E0C'],
  '--dp-color-surface': ['#FFFFFF', '#1A1815'],
  '--dp-color-surface-muted': ['#F2F0EC', '#231F1B'],
  '--dp-color-border': ['#E2DED7', '#332E28'],
  '--dp-color-text-primary': ['#1A1815', '#EAE7E2'],
  '--dp-color-text-secondary': ['#615C54', '#A09991'],
  '--dp-color-text-faint': ['#918B81', '#6F6961'],
  '--dp-color-rail-bg': ['#1A1815', '#221E1A'],
  '--dp-color-rail-text': ['#F2F0EC', '#EAE7E2'],
  '--dp-color-rail-muted': ['#A9A298', '#A09991'],
  '--dp-color-rail-faint': ['#9C958B', '#9A938A'],
  '--dp-color-rail-active': ['#2F2B24', '#332E28'],
  '--dp-color-rail-border': ['#2B2823', '#3A342D'],
  '--dp-color-success': ['#15803D', '#4ADE80'],
  '--dp-color-warning': ['#A16207', '#FCD34D'],
  '--dp-color-danger': ['#B91C1C', '#F87171'],
  '--dp-color-tag-bg': ['#F2F0EC', '#231F1B'],
  '--dp-color-tag-text': ['#524D45', '#A09991'],
  '--dp-color-chart1': ['#1D4ED8', '#60A5FA'],
  '--dp-color-chart2': ['#BE185D', '#F472B6'],
  '--dp-color-chart3': ['#7E22CE', '#D8B4FE'],
  '--dp-color-chart4': ['#0F766E', '#2DD4BF'],
  '--dp-color-chart5': ['#8B857D', '#8B857D'],
  '--dp-color-code-editor-bg': ['#1E1E1E', '#1E1E1E'],
  '--dp-color-code-log-bg': ['#0D1117', '#0D1117'],
  '--dp-color-code-text': ['#D4D4D4', '#C9D1D9'],
};

describe('Landing/App semantic token contract 1.0.0', () => {
  const light = declarations(':root');
  const dark = { ...light, ...declarations('[data-theme="dark"]') };

  it('mirrors every DpColors light and dark value', () => {
    for (const [name, [lightValue, darkValue]] of Object.entries(colors)) {
      expect(light[name], `${name} light`).toBe(lightValue);
      expect(dark[name], `${name} dark`).toBe(darkValue);
    }
  });

  it('mirrors spacing, radii, durations, layout, and window classes', () => {
    expect(light).toMatchObject({
      '--dp-token-manifest-version': '"1.0.0"',
      '--dp-space-xs': '4px',
      '--dp-space-sm': '8px',
      '--dp-space-md': '12px',
      '--dp-space-lg': '16px',
      '--dp-space-xl': '24px',
      '--dp-space-xxl': '32px',
      '--dp-space-xxxl': '48px',
      '--dp-radius-chip': '12px',
      '--dp-radius-button': '8px',
      '--dp-radius-panel': '10px',
      '--dp-radius-input': '8px',
      '--dp-radius-dialog': '12px',
      '--dp-duration-stage-reveal': '200ms',
      '--dp-duration-skeleton-crossfade': '150ms',
      '--dp-duration-hover': '120ms',
      '--dp-duration-select': '180ms',
      '--dp-duration-panel-expand': '220ms',
      '--dp-layout-content-max': '1440px',
      '--dp-layout-readable-max': '880px',
      '--dp-layout-rail': '256px',
      '--dp-layout-rail-collapsed': '72px',
      '--dp-breakpoint-medium': '600px',
      '--dp-breakpoint-expanded': '840px',
      '--dp-breakpoint-large': '1240px',
    });
  });

  it('mirrors every typography slot as a CSS font shorthand', () => {
    expect(light).toMatchObject({
      '--dp-type-display-small': '400 36px/44px "Pretendard"',
      '--dp-type-headline-small': '600 24px/32px "Pretendard"',
      '--dp-type-title-large': '700 20px/28px "Pretendard"',
      '--dp-type-title-medium': '600 16px/24px "Pretendard"',
      '--dp-type-title-small': '600 14px/20px "Pretendard"',
      '--dp-type-body-large': '400 16px/25.6px "Pretendard"',
      '--dp-type-body-medium': '400 14px/22.4px "Pretendard"',
      '--dp-type-body-small': '400 13px/20px "Pretendard"',
      '--dp-type-label-large': '600 14px/20px "Pretendard"',
      '--dp-type-label-medium': '600 12px/16px "Pretendard"',
      '--dp-type-label-small': '500 11px/16px "Pretendard"',
      '--dp-type-code': '400 14px/21px "D2Coding"',
    });
  });

  it('mirrors every interaction-state projection for light and dark', () => {
    const expected = {
      light: {
        default: ['#FFFFFF', '#1A1815', '#E2DED7'],
        hover: ['#F2F0EC', '#1A1815', '#E2DED7'],
        pressed: ['#F2F0EC', '#1A1815', '#78350F'],
        focus: ['#FFFFFF', '#1A1815', '#E2DED7'],
        selected: ['#FDF1E0', '#78350F', '#F2D0A0'],
        disabled: ['#F2F0EC', '#615C54', '#E2DED7'],
        error: ['#FFFFFF', '#B91C1C', '#B91C1C'],
      },
      dark: {
        default: ['#1A1815', '#EAE7E2', '#332E28'],
        hover: ['#231F1B', '#EAE7E2', '#332E28'],
        pressed: ['#231F1B', '#EAE7E2', '#FCD34D'],
        focus: ['#1A1815', '#EAE7E2', '#332E28'],
        selected: ['#2E2007', '#FCD34D', '#5C400E'],
        disabled: ['#231F1B', '#A09991', '#332E28'],
        error: ['#1A1815', '#F87171', '#F87171'],
      },
    };

    for (const [themeName, values] of Object.entries({ light, dark })) {
      for (const [state, [background, foreground, border]] of Object.entries(expected[themeName])) {
        expect(values[`--dp-state-${state}-background`]).toBe(background);
        expect(values[`--dp-state-${state}-foreground`]).toBe(foreground);
        expect(values[`--dp-state-${state}-border`]).toBe(border);
      }
    }
    expect(light['--dp-state-focus-ring']).toBe('#92400E');
    expect(dark['--dp-state-focus-ring']).toBe('#FBBF24');
    expect(light['--dp-state-focus-ring-width']).toBe('2px');
    expect(light['--dp-state-disabled-opacity']).toBe('0.56');
  });

  it('keeps stale Indigo/Slate design tokens out of the canonical contract', () => {
    expect(css).not.toMatch(/--(?:indigo|slate)-/i);
  });

  it('does not invent or omit any manifest, layout, or breakpoint property', () => {
    const dimensions = [
      ...['xs', 'sm', 'md', 'lg', 'xl', 'xxl', 'xxxl'].map((name) => `--dp-space-${name}`),
      ...['chip', 'button', 'panel', 'input', 'dialog'].map((name) => `--dp-radius-${name}`),
      ...['stage-reveal', 'skeleton-crossfade', 'hover', 'select', 'panel-expand']
        .map((name) => `--dp-duration-${name}`),
      ...[
        'display-small', 'headline-small', 'title-large', 'title-medium',
        'title-small', 'body-large', 'body-medium', 'body-small',
        'label-large', 'label-medium', 'label-small', 'code',
      ].map((name) => `--dp-type-${name}`),
    ];
    const states = Object.keys({
      default: true, hover: true, pressed: true, focus: true,
      selected: true, disabled: true, error: true,
    }).flatMap((state) => [
      `--dp-state-${state}-background`,
      `--dp-state-${state}-foreground`,
      `--dp-state-${state}-border`,
    ]);
    states.push(
      '--dp-state-focus-ring',
      '--dp-state-focus-ring-width',
      '--dp-state-disabled-opacity',
    );
    const layout = [
      '--dp-layout-content-max',
      '--dp-layout-readable-max',
      '--dp-layout-rail',
      '--dp-layout-rail-collapsed',
      '--dp-breakpoint-medium',
      '--dp-breakpoint-expanded',
      '--dp-breakpoint-large',
    ];
    const expected = new Set([
      '--dp-token-manifest-version',
      ...Object.keys(colors),
      ...dimensions,
      ...states,
      ...layout,
    ]);

    expect(Object.keys(light).sort()).toEqual([...expected].sort());
    expect(Object.keys(dark).sort()).toEqual([...expected].sort());
  });

  it('documents code-value ownership and the shared usage contract without stale directions', () => {
    expect(design).toContain('DpSemanticTokenManifest 1.0.0');
    expect(design).toContain('AppTokens.standard');
    expect(design).toContain('dp_window_class.dart');
    expect(design).toContain('frontend `DESIGN.md`');
    expect(design).toContain('assets/tokens.css');
    expect(design).toContain('Compact: 320–599px');
    expect(design).toContain('Medium: 600–839px');
    expect(design).toContain('Expanded: 840–1239px');
    expect(design).toContain('Large: 1240px 이상');
    expect(design).not.toMatch(/인디고|slate|4단계|Jaspr/i);
  });
});
