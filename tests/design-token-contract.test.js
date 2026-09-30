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
  '--dp-color-primary': ['#5653E7', '#9B99FF'],
  '--dp-color-primary-text': ['#4338CA', '#B9B8FF'],
  '--dp-color-primary-text-strong': ['#312E81', '#D8D8FF'],
  '--dp-color-on-primary': ['#FFFFFF', '#17163D'],
  '--dp-color-accent-soft': ['#EEF2FF', '#24244A'],
  '--dp-color-accent-line': ['#C7D2FE', '#454589'],
  '--dp-color-bg': ['#F6F7FB', '#0D0F15'],
  '--dp-color-surface': ['#FFFFFF', '#171922'],
  '--dp-color-surface-muted': ['#F0F2F7', '#222530'],
  '--dp-color-border': ['#DDE1EA', '#343846'],
  '--dp-color-text-primary': ['#171923', '#F4F5F8'],
  '--dp-color-text-secondary': ['#5E6472', '#B6BCC8'],
  '--dp-color-text-faint': ['#818998', '#858C99'],
  '--dp-color-header-bg': ['#11131B', '#090B10'],
  '--dp-color-header-text': ['#F5F7FB', '#F4F5F8'],
  '--dp-color-header-muted': ['#B7BDCA', '#B6BCC8'],
  '--dp-color-header-faint': ['#959DAD', '#929AA8'],
  '--dp-color-header-active': ['#272B3F', '#23263B'],
  '--dp-color-header-border': ['#2A2F3C', '#292D38'],
  '--dp-color-success': ['#137A48', '#5DD39E'],
  '--dp-color-warning': ['#9A5B00', '#F6C177'],
  '--dp-color-danger': ['#C12C36', '#FF7B84'],
  '--dp-color-tag-bg': ['#EEF0F5', '#262A36'],
  '--dp-color-tag-text': ['#4F5664', '#C3C8D2'],
  '--dp-color-chart1': ['#2563EB', '#77A5FF'],
  '--dp-color-chart2': ['#C026D3', '#E287F4'],
  '--dp-color-chart3': ['#D97706', '#F6B864'],
  '--dp-color-chart4': ['#0F766E', '#4DD4C4'],
  '--dp-color-chart5': ['#64748B', '#A1AAB8'],
  '--dp-color-code-editor-bg': ['#1E1E1E', '#1E1E1E'],
  '--dp-color-code-log-bg': ['#0D1117', '#0D1117'],
  '--dp-color-code-text': ['#D4D4D4', '#C9D1D9'],
};

describe('Landing/App semantic token contract 2.0.0', () => {
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
      '--dp-token-manifest-version': '"2.0.0"',
      '--dp-space-xs': '4px',
      '--dp-space-sm': '8px',
      '--dp-space-md': '12px',
      '--dp-space-lg': '16px',
      '--dp-space-xl': '24px',
      '--dp-space-xxl': '32px',
      '--dp-space-xxxl': '48px',
      '--dp-radius-chip': '4px',
      '--dp-radius-button': '6px',
      '--dp-radius-panel': '8px',
      '--dp-radius-input': '6px',
      '--dp-radius-dialog': '12px',
      '--dp-density-control-height': '30px',
      '--dp-density-row-padding': '8px',
      '--dp-density-min-target': '24px',
      '--dp-duration-stage-reveal': '200ms',
      '--dp-duration-skeleton-crossfade': '150ms',
      '--dp-duration-hover': '120ms',
      '--dp-duration-select': '180ms',
      '--dp-duration-panel-expand': '220ms',
      '--dp-layout-content-max': '1120px',
      '--dp-layout-readable-max': '760px',
      '--dp-layout-header-height': '56px',
      '--dp-layout-rail': '280px',
      '--dp-layout-rail-collapsed': '80px',
      '--dp-breakpoint-medium': '600px',
      '--dp-breakpoint-expanded': '840px',
      '--dp-breakpoint-large': '1240px',
    });
  });

  it('mirrors every typography slot as a CSS font shorthand', () => {
    expect(light).toMatchObject({
      '--dp-type-display-small': '400 36px/44px "Pretendard"',
      '--dp-type-headline-small': '700 28px/36px "Pretendard"',
      '--dp-type-title-large': '700 22px/30px "Pretendard"',
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
        default: ['#FFFFFF', '#171923', '#DDE1EA'],
        hover: ['#F0F2F7', '#171923', '#DDE1EA'],
        pressed: ['#F0F2F7', '#171923', '#312E81'],
        focus: ['#FFFFFF', '#171923', '#DDE1EA'],
        selected: ['#EEF2FF', '#312E81', '#C7D2FE'],
        disabled: ['#F0F2F7', '#5E6472', '#DDE1EA'],
        error: ['#FFFFFF', '#C12C36', '#C12C36'],
      },
      dark: {
        default: ['#171922', '#F4F5F8', '#343846'],
        hover: ['#222530', '#F4F5F8', '#343846'],
        pressed: ['#222530', '#F4F5F8', '#D8D8FF'],
        focus: ['#171922', '#F4F5F8', '#343846'],
        selected: ['#24244A', '#D8D8FF', '#454589'],
        disabled: ['#222530', '#B6BCC8', '#343846'],
        error: ['#171922', '#FF7B84', '#FF7B84'],
      },
    };

    for (const [themeName, values] of Object.entries({ light, dark })) {
      for (const [state, [background, foreground, border]] of Object.entries(expected[themeName])) {
        expect(values[`--dp-state-${state}-background`]).toBe(background);
        expect(values[`--dp-state-${state}-foreground`]).toBe(foreground);
        expect(values[`--dp-state-${state}-border`]).toBe(border);
      }
    }
    expect(light['--dp-state-focus-ring']).toBe('#4338CA');
    expect(dark['--dp-state-focus-ring']).toBe('#B9B8FF');
    expect(light['--dp-state-focus-ring-width']).toBe('2px');
    expect(light['--dp-state-disabled-opacity']).toBe('0.56');
  });

  it('reads the dark block through the exact selector the app dump does not emit', () => {
    const darkOnly = declarations('[data-theme="dark"]');
    expect(darkOnly['--dp-color-header-bg']).toBe('#090B10');
    expect(darkOnly['--dp-color-header-text']).toBe('#F4F5F8');
    expect(css).not.toMatch(/--dp-color-rail-/);
  });

  it('keeps pre-contract palette aliases out of the canonical contract', () => {
    expect(css).not.toMatch(/--(?:indigo|slate|amber|warm)-/i);
  });

  it('does not invent or omit any manifest, layout, or breakpoint property', () => {
    const dimensions = [
      ...['xs', 'sm', 'md', 'lg', 'xl', 'xxl', 'xxxl'].map((name) => `--dp-space-${name}`),
      ...['chip', 'button', 'panel', 'input', 'dialog'].map((name) => `--dp-radius-${name}`),
      ...['control-height', 'row-padding', 'min-target'].map((name) => `--dp-density-${name}`),
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
      '--dp-layout-header-height',
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
    expect(design).toContain('DpSemanticTokenManifest 2.0.0');
    expect(design).toContain('AppTokens.standard');
    expect(design).toContain('dp_window_class.dart');
    expect(design).toContain('frontend `DESIGN.md`');
    expect(design).toContain('assets/tokens.css');
    expect(design).toContain('Compact: 320–599px');
    expect(design).toContain('Medium: 600–839px');
    expect(design).toContain('Expanded: 840–1239px');
    expect(design).toContain('Large: 1240px 이상');
    expect(design).not.toMatch(/amber|앰버|warm neutral|slate|4단계|Jaspr/i);
  });
});
