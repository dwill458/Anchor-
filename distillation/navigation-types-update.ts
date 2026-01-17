// Add this to your RootStackParamList in src/types/index.ts

export type RootStackParamList = {
  // ... existing routes
  
  IntentionInput: undefined;
  
  // NEW: Insert this between IntentionInput and SigilSelection
  DistillationAnimation: {
    intentionText: string;
    category: AnchorCategory;
    distilledLetters: string[];
  };
  
  SigilSelection: {
    intentionText: string;
    category: AnchorCategory;
    distilledLetters: string[];
  };
  
  // ... rest of routes
};
