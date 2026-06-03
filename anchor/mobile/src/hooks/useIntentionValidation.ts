import { useMemo } from 'react';
import {
  analyzeIntention,
  detectGibberish,
  getGuidanceText,
  IntentionPatternDetection,
} from '@/utils/intentionPatterns';

export interface IntentionValidationDetection extends IntentionPatternDetection {
  isGibberish: boolean;
}

export interface IntentionValidationResult {
  isValid: boolean;
  canSubmit: boolean;
  guidanceText: string;
  detection: IntentionValidationDetection;
}

const minChars = 3;
const maxChars = 100;
const gibberishGuidance = "That doesn't look like an intention. What do you actually want?";

const emptyDetection: IntentionValidationDetection = {
  hasFutureTense: false,
  hasNegation: false,
  shouldShowGuidance: false,
  isGibberish: false,
};

export function useIntentionValidation(text: string): IntentionValidationResult {
  return useMemo(() => {
    const charCount = text.length;
    const isValid = charCount >= minChars && charCount <= maxChars;

    if (charCount < 6) {
      return {
        isValid,
        canSubmit: isValid,
        guidanceText: '',
        detection: emptyDetection,
      };
    }

    const isGibberish = detectGibberish(text);

    if (isGibberish) {
      return {
        isValid,
        canSubmit: isValid,
        guidanceText: gibberishGuidance,
        detection: {
          ...emptyDetection,
          shouldShowGuidance: true,
          isGibberish: true,
        },
      };
    }

    const intentionAnalysis = analyzeIntention(text);
    const guidanceText = getGuidanceText(
      intentionAnalysis.hasFutureTense,
      intentionAnalysis.hasNegation
    );

    return {
      isValid,
      canSubmit: isValid,
      guidanceText,
      detection: {
        ...intentionAnalysis,
        shouldShowGuidance: intentionAnalysis.shouldShowGuidance || guidanceText.length > 0,
        isGibberish: false,
      },
    };
  }, [text]);
}
