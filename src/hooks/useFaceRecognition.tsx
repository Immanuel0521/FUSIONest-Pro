import { useState, useCallback, useRef } from 'react';
import * as faceapi from 'face-api.js';

interface FaceDescriptor {
  descriptor: Float32Array;
  detection: faceapi.FaceDetection;
}

interface MatchResult {
  matched: boolean;
  workerId?: string;
  workerName?: string;
  confidence: number;
}

interface FaceEmbedding {
  worker_id: string;
  worker_name: string;
  embedding_data: number[];
}

// Threshold for face matching (lower = stricter)
// Relaxed from 0.5 to 0.6 for better real-world matching with multi-angle support
const MATCH_THRESHOLD = 0.6;

/** Configurable minimum confidence (0-100) for a match to be accepted */
export const FACE_CONFIDENCE_THRESHOLD = Number(
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_FACE_CONFIDENCE) || 75,
);

/**
 * Analyse average luminosity of the video frame.
 * Returns a value 0-255.  Below ~60 is too dark, above ~220 too bright.
 */
export function analyseFrameBrightness(video: HTMLVideoElement): number {
  try {
    const canvas = document.createElement('canvas');
    const size = 64; // Downscale for speed
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return 128;
    ctx.drawImage(video, 0, 0, size, size);
    const { data } = ctx.getImageData(0, 0, size, size);
    let total = 0;
    for (let i = 0; i < data.length; i += 4) {
      // Perceived luminosity formula
      total += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }
    return total / (size * size);
  } catch {
    return 128; // Assume OK on error
  }
}

export function useFaceRecognition() {
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Load face-api models
  const loadModels = useCallback(async () => {
    if (modelsLoaded) return true;
    
    setLoading(true);
    setError(null);
    
    try {
      // Load models from CDN
      const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model';
      
      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]);
      
      setModelsLoaded(true);
      setLoading(false);
      return true;
    } catch (err: any) {
      console.error('Error loading face models:', err);
      setError('Failed to load face recognition models');
      setLoading(false);
      return false;
    }
  }, [modelsLoaded]);

  // Start camera stream
  const startCamera = useCallback(async (video: HTMLVideoElement, facingMode: 'user' | 'environment' = 'user') => {
    try {
      // Stop existing stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode,
          width: { ideal: 640 },
          height: { ideal: 480 }
        },
        audio: false,
      });

      video.srcObject = stream;
      videoRef.current = video;
      streamRef.current = stream;
      
      return new Promise<boolean>((resolve) => {
        video.onloadedmetadata = () => {
          video.play();
          resolve(true);
        };
      });
    } catch (err: any) {
      console.error('Camera error:', err);
      setError(err.message || 'Failed to access camera');
      return false;
    }
  }, []);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current = null;
    }
  }, []);

  // Detect face and get descriptor from video
  const detectFace = useCallback(async (video: HTMLVideoElement): Promise<FaceDescriptor | null> => {
    if (!modelsLoaded) {
      setError('Models not loaded');
      return null;
    }

    try {
      const detection = await faceapi
        .detectSingleFace(video, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        return null;
      }

      return {
        descriptor: detection.descriptor,
        detection: detection.detection,
      };
    } catch (err: any) {
      console.error('Face detection error:', err);
      return null;
    }
  }, [modelsLoaded]);

  // Detect face from image element
  const detectFaceFromImage = useCallback(async (image: HTMLImageElement): Promise<FaceDescriptor | null> => {
    if (!modelsLoaded) {
      setError('Models not loaded');
      return null;
    }

    try {
      const detection = await faceapi
        .detectSingleFace(image, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        return null;
      }

      return {
        descriptor: detection.descriptor,
        detection: detection.detection,
      };
    } catch (err: any) {
      console.error('Face detection error:', err);
      return null;
    }
  }, [modelsLoaded]);

  // Compare two face descriptors
  const compareFaces = useCallback((descriptor1: Float32Array, descriptor2: Float32Array): number => {
    const distance = faceapi.euclideanDistance(descriptor1, descriptor2);
    // Convert distance to confidence (0-100)
    const confidence = Math.max(0, Math.min(100, (1 - distance) * 100));
    return confidence;
  }, []);

  // Match against stored embeddings
  const matchFace = useCallback((
    descriptor: Float32Array,
    storedEmbeddings: FaceEmbedding[]
  ): MatchResult => {
    let bestMatch: MatchResult = {
      matched: false,
      confidence: 0,
    };

    for (const embedding of storedEmbeddings) {
      const storedDescriptor = new Float32Array(embedding.embedding_data);
      const distance = faceapi.euclideanDistance(descriptor, storedDescriptor);
      const confidence = Math.max(0, Math.min(100, (1 - distance) * 100));

      if (distance < MATCH_THRESHOLD && confidence > bestMatch.confidence) {
        bestMatch = {
          matched: true,
          workerId: embedding.worker_id,
          workerName: embedding.worker_name,
          confidence: Math.round(confidence),
        };
      }
    }

    return bestMatch;
  }, []);

  // Capture current frame as base64
  const captureFrame = useCallback((video: HTMLVideoElement): string | null => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      
      ctx.drawImage(video, 0, 0);
      return canvas.toDataURL('image/jpeg', 0.8);
    } catch (err) {
      console.error('Frame capture error:', err);
      return null;
    }
  }, []);

  return {
    modelsLoaded,
    loading,
    error,
    loadModels,
    startCamera,
    stopCamera,
    detectFace,
    detectFaceFromImage,
    compareFaces,
    matchFace,
    captureFrame,
  };
}
