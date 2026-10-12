export type GuidanceVoice = "female" | "male" | "none";
export type BackgroundAudioMode = "ambient" | "off";
export type SessionAudioSessionType = "focus" | "deep_prime" | "visualize";
export type SessionAudioConfigurationSource = "default" | "session_override";

export interface SessionAudioDefaults {
  guidanceVoice: GuidanceVoice;
  backgroundAudio: BackgroundAudioMode;
}

export interface SessionAudioConfiguration extends SessionAudioDefaults {
  source: SessionAudioConfigurationSource;
}

export type SessionAudioDefaultsByType = Record<
  SessionAudioSessionType,
  SessionAudioDefaults
>;

export type LegacySessionAudioMode = "silent" | "ambient";

export const DEFAULT_SESSION_AUDIO_DEFAULTS: SessionAudioDefaultsByType = {
  focus: {
    guidanceVoice: "female",
    backgroundAudio: "ambient",
  },
  deep_prime: {
    guidanceVoice: "female",
    backgroundAudio: "ambient",
  },
  visualize: {
    guidanceVoice: "female",
    backgroundAudio: "ambient",
  },
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value != null && typeof value === "object" && !Array.isArray(value);

export const normalizeGuidanceVoice = (
  value: unknown,
  fallback: GuidanceVoice = "female",
): GuidanceVoice =>
  value === "female" || value === "male" || value === "none" ? value : fallback;

export const normalizeBackgroundAudio = (
  value: unknown,
  fallback: BackgroundAudioMode = "ambient",
): BackgroundAudioMode =>
  value === "ambient" || value === "off" ? value : fallback;

export const normalizeSessionAudioDefaults = (
  value: unknown,
  fallback: SessionAudioDefaults,
): SessionAudioDefaults => {
  if (!isRecord(value)) {
    return { ...fallback };
  }

  return {
    guidanceVoice: normalizeGuidanceVoice(
      value.guidanceVoice,
      fallback.guidanceVoice,
    ),
    backgroundAudio: normalizeBackgroundAudio(
      value.backgroundAudio,
      fallback.backgroundAudio,
    ),
  };
};

export const normalizeSessionAudioDefaultsByType = (
  value: unknown,
  fallback: SessionAudioDefaultsByType = DEFAULT_SESSION_AUDIO_DEFAULTS,
): SessionAudioDefaultsByType => {
  if (!isRecord(value)) {
    return {
      focus: { ...fallback.focus },
      deep_prime: { ...fallback.deep_prime },
      visualize: { ...fallback.visualize },
    };
  }

  return {
    focus: normalizeSessionAudioDefaults(value.focus, fallback.focus),
    deep_prime: normalizeSessionAudioDefaults(
      value.deep_prime,
      fallback.deep_prime,
    ),
    visualize: normalizeSessionAudioDefaults(
      value.visualize,
      fallback.visualize,
    ),
  };
};

export const isSessionAudioDefaultsByType = (
  value: unknown,
): value is SessionAudioDefaultsByType => {
  if (
    !isRecord(value) ||
    !isRecord(value.focus) ||
    !isRecord(value.deep_prime) ||
    !isRecord(value.visualize)
  ) {
    return false;
  }

  const isValidDefaults = (defaults: Record<string, unknown>) =>
    (defaults.guidanceVoice === "female" ||
      defaults.guidanceVoice === "male" ||
      defaults.guidanceVoice === "none") &&
    (defaults.backgroundAudio === "ambient" ||
      defaults.backgroundAudio === "off");

  return (
    isValidDefaults(value.focus) &&
    isValidDefaults(value.deep_prime) &&
    isValidDefaults(value.visualize)
  );
};

const readOptionalBoolean = (
  record: Record<string, unknown>,
  keys: readonly string[],
): boolean | undefined => {
  for (const key of keys) {
    if (typeof record[key] === "boolean") {
      return record[key] as boolean;
    }
  }
  return undefined;
};

const legacyModeToDefaults = (
  mode: unknown,
  voiceEnabled: boolean | undefined,
  ambientEnabled: boolean | undefined,
  fallback: SessionAudioDefaults,
): SessionAudioDefaults => {
  const normalizedMode: LegacySessionAudioMode | undefined =
    mode === "ambient" || mode === "silent" ? mode : undefined;

  return {
    guidanceVoice:
      voiceEnabled === false
        ? "none"
        : voiceEnabled === true || normalizedMode === "ambient"
          ? "female"
          : normalizedMode === "silent"
            ? "none"
            : fallback.guidanceVoice,
    backgroundAudio:
      ambientEnabled === true
        ? "ambient"
        : ambientEnabled === false
          ? "off"
          : normalizedMode === "ambient"
            ? "ambient"
            : normalizedMode === "silent"
              ? "off"
              : fallback.backgroundAudio,
  };
};

/**
 * Idempotently migrates every legacy audio shape found in shipped settings.
 * A valid new value always wins, so rerunning migration cannot overwrite a
 * user's newer Voice & Sound choices.
 */
export const migrateLegacySessionAudioDefaults = (
  persistedState: unknown,
): SessionAudioDefaultsByType => {
  if (!isRecord(persistedState)) {
    return normalizeSessionAudioDefaultsByType(undefined);
  }

  if (isSessionAudioDefaultsByType(persistedState.sessionAudioDefaults)) {
    return normalizeSessionAudioDefaultsByType(
      persistedState.sessionAudioDefaults,
    );
  }

  const defaultActivation = isRecord(persistedState.defaultActivation)
    ? persistedState.defaultActivation
    : undefined;
  const existingDefaults = isRecord(persistedState.sessionAudioDefaults)
    ? persistedState.sessionAudioDefaults
    : undefined;
  const sharedVoiceEnabled = readOptionalBoolean(persistedState, [
    "guidedVoiceEnabled",
    "voiceEnabled",
  ]);
  const sharedAmbientEnabled = readOptionalBoolean(persistedState, [
    "ambientSoundEnabled",
    "backgroundSoundEnabled",
  ]);

  return {
    focus: existingDefaults?.focus
      ? normalizeSessionAudioDefaults(
          existingDefaults.focus,
          DEFAULT_SESSION_AUDIO_DEFAULTS.focus,
        )
      : legacyModeToDefaults(
          persistedState.focusSessionAudio ?? defaultActivation?.mode,
          readOptionalBoolean(persistedState, ["focusGuidedVoiceEnabled"]) ??
            sharedVoiceEnabled,
          readOptionalBoolean(persistedState, ["focusAmbientSoundEnabled"]) ??
            sharedAmbientEnabled,
          DEFAULT_SESSION_AUDIO_DEFAULTS.focus,
        ),
    deep_prime: existingDefaults?.deep_prime
      ? normalizeSessionAudioDefaults(
          existingDefaults.deep_prime,
          DEFAULT_SESSION_AUDIO_DEFAULTS.deep_prime,
        )
      : legacyModeToDefaults(
          persistedState.primeSessionAudio,
          readOptionalBoolean(persistedState, ["primeGuidedVoiceEnabled"]) ??
            sharedVoiceEnabled,
          readOptionalBoolean(persistedState, ["primeAmbientSoundEnabled"]) ??
            sharedAmbientEnabled,
          DEFAULT_SESSION_AUDIO_DEFAULTS.deep_prime,
        ),
    visualize: normalizeSessionAudioDefaults(
      existingDefaults?.visualize,
      DEFAULT_SESSION_AUDIO_DEFAULTS.visualize,
    ),
  };
};

export const resolveSessionAudioConfiguration = (
  defaults: SessionAudioDefaults,
  override?: SessionAudioDefaults | null,
): SessionAudioConfiguration => ({
  ...(override ?? defaults),
  source: override ? "session_override" : "default",
});

export const sessionAudioConfigurationToDefaults = (
  configuration: SessionAudioConfiguration,
): SessionAudioDefaults => ({
  guidanceVoice: configuration.guidanceVoice,
  backgroundAudio: configuration.backgroundAudio,
});

/**
 * Experience-based names for the guidance voices. The stored ids stay
 * "male"/"female"/"none" (they key backend settings and audio assets); only
 * what the person reads changes. Grounded is Dominic, Serene is Lina.
 */
export const GUIDANCE_VOICE_LABELS: Record<GuidanceVoice, string> = {
  male: "Grounded",
  female: "Serene",
  none: "No guidance",
};

export const GUIDANCE_VOICE_DESCRIPTIONS: Record<GuidanceVoice, string> = {
  male: "Steady, measured, reassuring.",
  female: "Gentle, warm, reflective.",
  none: "No spoken instruction.",
};

export const BACKGROUND_AUDIO_LABELS: Record<BackgroundAudioMode, string> = {
  ambient: "Ambient",
  off: "Silence",
};

export const formatSessionAudioSummary = (
  configuration: SessionAudioDefaults,
): string =>
  `${GUIDANCE_VOICE_LABELS[configuration.guidanceVoice]} · ${BACKGROUND_AUDIO_LABELS[configuration.backgroundAudio]}`;

export const formatCompactSessionAudioSummary = (
  configuration: SessionAudioDefaults,
): string =>
  `${GUIDANCE_VOICE_LABELS[configuration.guidanceVoice]} • ${BACKGROUND_AUDIO_LABELS[configuration.backgroundAudio]}`;

export const isSessionAudioSilent = (
  configuration: SessionAudioDefaults,
): boolean =>
  configuration.guidanceVoice === "none" &&
  configuration.backgroundAudio === "off";

export const legacyAudioModeToSessionAudioDefaults = (
  mode: LegacySessionAudioMode,
): SessionAudioDefaults =>
  mode === "ambient"
    ? { guidanceVoice: "female", backgroundAudio: "ambient" }
    : { guidanceVoice: "none", backgroundAudio: "off" };
