// Palettes and lobe geometry copied from voice-glow by Jakub Antalik (MIT,
// see LICENSE): https://github.com/Jakubantalik/Libraries.dev/tree/main/packages/voice-glow

export type HuePalette = 'colorful' | 'mono' | 'ocean' | 'sunset' | 'forest' | 'candy' | 'ice' | 'gold';

/** Seven soft ellipses fanning out from the bottom centre, sized for a ~350px-wide element. */
export interface Lobe {
  x: number;
  w: number;
  h: number;
  band: 0 | 1 | 2;
}

export const voiceLobes: readonly Lobe[] = [
  { x: 0, w: 74, h: 46, band: 0 },
  { x: -36, w: 54, h: 40, band: 1 },
  { x: 36, w: 54, h: 40, band: 1 },
  { x: -72, w: 48, h: 32, band: 2 },
  { x: 72, w: 48, h: 32, band: 2 },
  { x: -108, w: 42, h: 26, band: 1 },
  { x: 108, w: 42, h: 26, band: 1 },
];

export const voicePalettes: Record<HuePalette, { dark: string[]; light: string[] }> = {
  colorful: {
    dark: [
      'rgb(255, 70, 120)',
      'rgb(60, 190, 255)',
      'rgb(175, 70, 255)',
      'rgb(60, 220, 130)',
      'rgb(255, 150, 40)',
      'rgb(90, 100, 255)',
      'rgb(40, 200, 190)',
    ],
    // Candy on white: pinks, sky, lavender, mint, peach, periwinkle,
    // aqua — pastel bodies that the light preset's saturation lifts.
    // Candy on white: gold, sky, violet, rose, peach, periwinkle, aqua —
    // tuned in the Studio; the light preset's saturation lifts them.
    light: [
      'rgb(255, 201, 21)',
      'rgb(126, 196, 255)',
      'rgb(180, 40, 230)',
      'rgb(235, 100, 160)',
      'rgb(255, 176, 122)',
      'rgb(154, 160, 255)',
      'rgb(127, 217, 238)',
    ],
  },
  mono: {
    dark: [
      'rgb(215, 215, 215)',
      'rgb(180, 180, 180)',
      'rgb(190, 190, 190)',
      'rgb(160, 160, 160)',
      'rgb(170, 170, 170)',
      'rgb(150, 150, 150)',
      'rgb(155, 155, 155)',
    ],
    light: [
      'rgb(60, 60, 60)',
      'rgb(90, 90, 90)',
      'rgb(85, 85, 85)',
      'rgb(110, 110, 110)',
      'rgb(105, 105, 105)',
      'rgb(125, 125, 125)',
      'rgb(120, 120, 120)',
    ],
  },
  ocean: {
    dark: [
      'rgb(80, 140, 255)',
      'rgb(40, 200, 230)',
      'rgb(120, 90, 255)',
      'rgb(30, 170, 210)',
      'rgb(160, 80, 240)',
      'rgb(60, 110, 255)',
      'rgb(40, 190, 180)',
    ],
    light: [
      'rgb(40, 100, 240)',
      'rgb(20, 160, 200)',
      'rgb(90, 60, 230)',
      'rgb(20, 130, 180)',
      'rgb(130, 50, 220)',
      'rgb(40, 80, 230)',
      'rgb(20, 150, 150)',
    ],
  },
  sunset: {
    dark: [
      'rgb(255, 110, 60)',
      'rgb(255, 180, 40)',
      'rgb(255, 60, 90)',
      'rgb(255, 210, 80)',
      'rgb(240, 70, 140)',
      'rgb(255, 140, 50)',
      'rgb(230, 50, 110)',
    ],
    light: [
      'rgb(235, 80, 30)',
      'rgb(230, 150, 10)',
      'rgb(230, 30, 70)',
      'rgb(225, 175, 30)',
      'rgb(215, 40, 110)',
      'rgb(235, 110, 20)',
      'rgb(205, 30, 90)',
    ],
  },
  forest: {
    dark: [
      'rgb(70, 220, 120)',
      'rgb(40, 200, 180)',
      'rgb(140, 230, 80)',
      'rgb(30, 170, 140)',
      'rgb(190, 235, 70)',
      'rgb(50, 190, 110)',
      'rgb(30, 150, 120)',
    ],
    light: [
      'rgb(30, 170, 80)',
      'rgb(20, 150, 130)',
      'rgb(90, 180, 30)',
      'rgb(20, 130, 100)',
      'rgb(130, 180, 20)',
      'rgb(30, 150, 80)',
      'rgb(20, 120, 90)',
    ],
  },
  candy: {
    dark: [
      'rgb(255, 90, 170)',
      'rgb(255, 120, 220)',
      'rgb(210, 80, 255)',
      'rgb(255, 150, 190)',
      'rgb(180, 110, 255)',
      'rgb(255, 70, 140)',
      'rgb(230, 100, 240)',
    ],
    light: [
      'rgb(235, 40, 140)',
      'rgb(230, 70, 190)',
      'rgb(180, 40, 230)',
      'rgb(235, 100, 160)',
      'rgb(150, 70, 230)',
      'rgb(230, 30, 110)',
      'rgb(200, 60, 210)',
    ],
  },
  ice: {
    dark: [
      'rgb(150, 230, 255)',
      'rgb(90, 200, 255)',
      'rgb(190, 240, 255)',
      'rgb(120, 190, 255)',
      'rgb(160, 220, 250)',
      'rgb(80, 170, 255)',
      'rgb(200, 235, 255)',
    ],
    light: [
      'rgb(30, 160, 220)',
      'rgb(20, 130, 210)',
      'rgb(60, 180, 230)',
      'rgb(40, 120, 220)',
      'rgb(50, 160, 220)',
      'rgb(20, 110, 220)',
      'rgb(70, 170, 230)',
    ],
  },
  gold: {
    dark: [
      'rgb(255, 200, 70)',
      'rgb(255, 170, 40)',
      'rgb(255, 220, 110)',
      'rgb(240, 150, 30)',
      'rgb(255, 235, 140)',
      'rgb(230, 160, 40)',
      'rgb(250, 210, 90)',
    ],
    light: [
      'rgb(200, 140, 10)',
      'rgb(190, 120, 0)',
      'rgb(210, 160, 30)',
      'rgb(180, 110, 0)',
      'rgb(205, 170, 40)',
      'rgb(175, 115, 5)',
      'rgb(195, 150, 20)',
    ],
  },
};
