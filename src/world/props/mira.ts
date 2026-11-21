// mira.ts — props for Mira's moment: "14 March 2004: open mic". Owner: Claude.

import type { Prop } from '../layout.ts';
import { BENCH_TOP, BOARD_FRONT, PAST, POST_TOP, mountOn, standOn } from './helpers.ts';

const M = ['open_mic'];

export const PROPS_MIRA: readonly Prop[] = [
  { id: 'mira_cd', shape: 'box', eras: PAST, moments: M, pos: [-2, standOn(BENCH_TOP, 0.03), 0], size: [0.3, 0.03, 0.3], color: '#d0d8e0', interactable: true },
  { id: 'listening_post', shape: 'box', eras: PAST, moments: M, pos: [1.2, standOn(0, 1.3), -4.2], size: [0.6, 1.3, 0.6], color: '#8a3fb0', interactable: true },
  { id: 'open_mic_sign', shape: 'box', eras: PAST, moments: M, pos: [1.2, standOn(POST_TOP, 0.4), -4.2], size: [0.5, 0.4, 0.06], color: '#ffd166' },
  { id: 'mira_flyer', shape: 'box', eras: PAST, moments: M, pos: [3.6, 1.3, mountOn(BOARD_FRONT, 0.02)], size: [0.4, 0.55, 0.02], color: '#ff5fa2', startsHidden: true },
];
