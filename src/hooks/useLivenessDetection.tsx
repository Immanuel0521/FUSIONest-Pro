import { useState, useCallback, useRef } from 'react';
import * as faceapi from 'face-api.js';

/**
 * Liveness detection hook — detects blink (Eye Aspect Ratio) and
 * head-turn challenges to defend against static-photo presentation attacks.
 *
 * Uses MediaPipe-compatible 68-point landmarks from face-api.js.
 * The EAR method is well-documented in:
 *   Soukupová & Čech, "Real-Time Eye Blink Detection using Facial Landmarks" (2016)
 */

// 68-landmark indices for left & right eye (face-api.js convention)
const LEFT_EYE = [36, 37, 38, 39, 40, 41] as const;
const RIGHT_EYE = [42, 43, 44, 45, 46, 47] as const;

// Nose tip & chin (used for head-pose estimation)
const NOSE_TIP = 30;
const LEFT_FACE_EDGE = 0;
const RIGHT_FACE_EDGE = 16;

/** Eye Aspect Ratio threshold – below this the eye is considered closed */
const EAR_THRESHOLD = 0.22;

/** Minimum consecutive frames with EAR < threshold to count as a blink */
const BLINK_CONSEC_FRAMES = 2;

/** Head-turn ratio threshold – nose displacement relative to face width */
const HEAD_TURN_THRESHOLD = 0.12;

export type LivenessChallenge = 'blink' | 'turn_left' | 'turn_right';

export interface LivenessState {
  /** Whether liveness has been verified */
  verified: boolean;
  /** Current challenge being presented to the user */
  currentChallenge: LivenessChallenge | null;
  /** Number of challenges completed so far */
  completedCount: number;
  /** Total challenges required */
  totalChallenges: number;
  /** Human-readable instruction */
  instruction: string;
  /** Whether detection loop is active */
  detecting: boolean;
}

interface UseLivenessResult {
  state: LivenessState;
  startDetection: (video: HTMLVideoElement) => void;
  stopDetection: () => void;
  reset: () => void;
}

function euclidean(p1: faceapi.Point, p2: faceapi.Point): number {
  return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
}

function eyeAspectRatio(landmarks: faceapi.Point[], indices: readonly number[]): number {
  const p = indices.map(i => landmarks[i]);
  const vertical1 = euclidean(p[1], p[5]);
  const vertical2 = euclidean(p[2], p[4]);
  const horizontal = euclidean(p[0], p[3]);
  return (vertical1 + vertical2) / (2.0 * horizontal);
}

const CHALLENGES: LivenessChallenge[] = ['blink', 'turn_left'];

const CHALLENGE_INSTRUCTIONS: Record<LivenessChallenge, string> = {
  blink: 'Please blink your eyes naturally',
  turn_left: 'Turn your head slightly to the left',
  turn_right: 'Turn your head slightly to the right',
};

export function useLivenessDetection(): UseLivenessResult {
  const [state, setState] = useState<LivenessState>({
    verified: false,
    currentChallenge: null,
    completedCount: 0,
    totalChallenges: CHALLENGES.length,
    instruction: '',
    detecting: false,
  });

  const blinkCounterRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const completedRef = useRef<Set<LivenessChallenge>>(new Set());

  const advanceOrVerify = useCallback(() => {
    const nextIdx = completedRef.current.size;
    if (nextIdx >= CHALLENGES.length) {
      // All challenges passed
      setState(prev => ({
        ...prev,
        verified: true,
        currentChallenge: null,
        completedCount: CHALLENGES.length,
        instruction: '✓ Liveness verified!',
        detecting: false,
      }));
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    } else {
      const next = CHALLENGES[nextIdx];
      setState(prev => ({
        ...prev,
        currentChallenge: next,
        completedCount: nextIdx,
        instruction: CHALLENGE_INSTRUCTIONS[next],
      }));
    }
  }, []);

  const startDetection = useCallback((video: HTMLVideoElement) => {
    completedRef.current.clear();
    blinkCounterRef.current = 0;

    const firstChallenge = CHALLENGES[0];
    setState({
      verified: false,
      currentChallenge: firstChallenge,
      completedCount: 0,
      totalChallenges: CHALLENGES.length,
      instruction: CHALLENGE_INSTRUCTIONS[firstChallenge],
      detecting: true,
    });

    intervalRef.current = setInterval(async () => {
      try {
        const detection = await faceapi
          .detectSingleFace(video, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
          .withFaceLandmarks();

        if (!detection) return;

        const pts = detection.landmarks.positions;
        const current = CHALLENGES[completedRef.current.size];
        if (!current) return;

        if (current === 'blink') {
          const leftEAR = eyeAspectRatio(pts, LEFT_EYE);
          const rightEAR = eyeAspectRatio(pts, RIGHT_EYE);
          const avgEAR = (leftEAR + rightEAR) / 2;

          if (avgEAR < EAR_THRESHOLD) {
            blinkCounterRef.current++;
          } else {
            if (blinkCounterRef.current >= BLINK_CONSEC_FRAMES) {
              completedRef.current.add('blink');
              blinkCounterRef.current = 0;
              advanceOrVerify();
            }
            blinkCounterRef.current = 0;
          }
        }

        if (current === 'turn_left' || current === 'turn_right') {
          const nose = pts[NOSE_TIP];
          const leftEdge = pts[LEFT_FACE_EDGE];
          const rightEdge = pts[RIGHT_FACE_EDGE];
          const faceWidth = euclidean(leftEdge, rightEdge);
          const faceCenterX = (leftEdge.x + rightEdge.x) / 2;

          // Positive displacement = nose is right of center, negative = left
          const displacement = (nose.x - faceCenterX) / faceWidth;

          if (current === 'turn_left' && displacement > HEAD_TURN_THRESHOLD) {
            // Camera mirrors: user turns left → nose moves right in mirrored video
            completedRef.current.add('turn_left');
            advanceOrVerify();
          }
          if (current === 'turn_right' && displacement < -HEAD_TURN_THRESHOLD) {
            completedRef.current.add('turn_right');
            advanceOrVerify();
          }
        }
      } catch {
        // Detection frame failed – silently skip
      }
    }, 300);
  }, [advanceOrVerify]);

  const stopDetection = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setState(prev => ({ ...prev, detecting: false }));
  }, []);

  const reset = useCallback(() => {
    stopDetection();
    completedRef.current.clear();
    blinkCounterRef.current = 0;
    setState({
      verified: false,
      currentChallenge: null,
      completedCount: 0,
      totalChallenges: CHALLENGES.length,
      instruction: '',
      detecting: false,
    });
  }, [stopDetection]);

  return { state, startDetection, stopDetection, reset };
}
