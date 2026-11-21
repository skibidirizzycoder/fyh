// camera.ts — the follow camera. It glides after the player by game steps (a damped follow) and
// cuts straight there after a jump (travel, restart). While a dialogue line shows it eases a little
// closer and lower, and back afterwards; when a CD is fixed it pushes in briefly with a slight tilt.
// Everything runs on game frames, so the debug step() stays exact. Numbers: T.avatar (camera*, talk*, cheer*).

import * as THREE from 'three';
import { forwardFromYaw } from '../core/facing.ts';
import { T } from '../tuning.ts';
import type { PlayerState } from './controller.ts';

const A = T.avatar;

/** What the scene asks of the camera right now. */
export interface CameraMood {
  talking: boolean; // a dialogue line is showing
}

export interface FollowCamera {
  /** Moves `camera` for the player state at game `frame` (no frame: straight to its spot). */
  update(p: PlayerState, camera: THREE.PerspectiveCamera, frame: number | undefined, mood: CameraMood): void;
  /** A CD was fixed at game `frame`: push in with a slight tilt. */
  cheer(frame: number): void;
}

/** Distance behind, height and roll of the camera, for how far it has eased into talking (0..1) and cheering (0..1). */
export function framing(talk: number, cheer: number): { distance: number; height: number; rollRad: number } {
  return {
    distance: T.camera.distance * (1 - A.talkCloser * talk) * (1 - A.cheerCloser * cheer),
    height: T.camera.height - A.talkLowerM * talk,
    rollRad: THREE.MathUtils.degToRad(A.cheerTiltDeg) * cheer,
  };
}

/** How far into its push-in a cheer is, `steps` after it started: up and back down over T.avatar.cheerSec. */
export function cheerCurve(steps: number): number {
  const t = steps / (A.cheerSec * T.loop.stepsPerSecond);
  return t <= 0 || t >= 1 ? 0 : Math.sin(Math.PI * t);
}

/** The part of the way to go after `steps` game steps, moving `rate` of what is left each step. */
export function followShare(rate: number, steps: number): number {
  return 1 - Math.pow(1 - rate, Math.max(0, steps));
}

/** Where the camera wants to be for a player state and framing, and the point it aims at. */
function cameraGoal(p: PlayerState, f: { distance: number; height: number }): { eye: THREE.Vector3; aim: THREE.Vector3 } {
  const fwd = forwardFromYaw(p.yawDeg);
  return {
    eye: new THREE.Vector3(p.x - fwd.x * f.distance, f.height, p.z - fwd.z * f.distance),
    aim: new THREE.Vector3(p.x, T.camera.lookHeight, p.z),
  };
}

/** Creates the follow camera's state. */
export function createFollowCamera(): FollowCamera {
  let view: { eye: THREE.Vector3; aim: THREE.Vector3; frame: number | undefined } | null = null; // the camera now
  let talk = 0; // 0 = normal, 1 = fully eased in for a dialogue line
  let cheerFrom: number | null = null; // the frame the last CD was fixed

  /** Steps since the last update, or undefined when there is nothing to glide from. */
  function stepsSince(frame: number | undefined): number | undefined {
    return view && frame !== undefined && view.frame !== undefined ? frame - view.frame : undefined;
  }

  return {
    update(p, camera, frame, mood) {
      const steps = stepsSince(frame);
      const want = mood.talking ? 1 : 0;
      talk = steps === undefined ? want : talk + (want - talk) * followShare(A.talkEase, steps);
      const cheer = frame === undefined || cheerFrom === null ? 0 : cheerCurve(frame - cheerFrom);
      const f = framing(talk, cheer);
      const goal = cameraGoal(p, f);
      if (view && steps !== undefined && view.eye.distanceTo(goal.eye) <= A.cameraSnapM) {
        view.eye.lerp(goal.eye, followShare(A.cameraFollow, steps));
        view.aim.lerp(goal.aim, followShare(A.cameraLookFollow, steps));
        view.frame = frame;
      } else {
        view = { ...goal, frame };
      }
      camera.position.copy(view.eye);
      camera.lookAt(view.aim);
      camera.rotateZ(f.rollRad); // the cheer's tilt (roll only: the camera still looks where it did)
    },
    cheer(frame) {
      cheerFrom = frame;
    },
  };
}
