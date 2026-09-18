export type Platform = 'ios' | 'android' | 'unknown';
export type MediaType = 'photo' | 'video' | '360';
export type Answer = 'YES' | 'NO' | 'UNCERTAIN';
export type VerificationStatus = 'PENDING' | 'VERIFIED' | 'NEEDS_REVIEW' | 'REJECTED';
export type FreshnessStatus = 'FRESH' | 'AGING' | 'STALE' | 'UNKNOWN';
export type IntegrityStatus = 'PENDING' | 'MATCHED' | 'FAILED';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface VerificationTaskContract {
  id: string;
  publicId: string;
  placeName: string;
  featureName: string;
  featureType: string;
  questionType: string;
  questionText: string;
  target: Coordinates;
  requiredPhotoCount: number;
  requiredVideoCount: number;
  maxDistanceM: number;
  maxAccuracyM: number;
  freshnessPolicyDays: number;
  policyVersion: string;
}

export interface CaptureSessionContract {
  id: string;
  publicId: string;
  nonce: string;
  serverStartedAt: string;
  serverExpiresAt: string;
  status: string;
  task: VerificationTaskContract;
}

export interface LocationValidationResult {
  distanceM: number;
  accuracyM: number;
  withinDistance: boolean;
  accuracyGood: boolean;
  canCapture: boolean;
}
