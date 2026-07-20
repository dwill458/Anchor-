import {
  DEFAULT_SESSION_AUDIO_DEFAULTS,
  formatSessionAudioSummary,
  migrateLegacySessionAudioDefaults,
  normalizeSessionAudioDefaultsByType,
  resolveSessionAudioConfiguration,
} from "../sessionAudio";

describe("session audio preference domain", () => {
  it.each([
    ["ambient", { guidanceVoice: "female", backgroundAudio: "ambient" }],
    ["silent", { guidanceVoice: "none", backgroundAudio: "off" }],
  ] as const)("migrates legacy %s modes independently", (mode, expected) => {
    expect(
      migrateLegacySessionAudioDefaults({
        focusSessionAudio: mode,
        primeSessionAudio: mode === "ambient" ? "silent" : "ambient",
      }),
    ).toEqual({
      focus: expected,
      deep_prime:
        mode === "ambient"
          ? { guidanceVoice: "none", backgroundAudio: "off" }
          : { guidanceVoice: "female", backgroundAudio: "ambient" },
      visualize: DEFAULT_SESSION_AUDIO_DEFAULTS.visualize,
    });
  });

  it("keeps a valid new value unchanged when migration runs more than once", () => {
    const current = {
      focus: {
        guidanceVoice: "male" as const,
        backgroundAudio: "off" as const,
      },
      deep_prime: {
        guidanceVoice: "none" as const,
        backgroundAudio: "ambient" as const,
      },
      visualize: {
        guidanceVoice: "female" as const,
        backgroundAudio: "ambient" as const,
      },
    };
    const first = migrateLegacySessionAudioDefaults({
      sessionAudioDefaults: current,
      focusSessionAudio: "ambient",
      primeSessionAudio: "ambient",
    });

    expect(first).toEqual(current);
    expect(
      migrateLegacySessionAudioDefaults({ sessionAudioDefaults: first }),
    ).toEqual(current);
  });

  it("normalizes corrupt nested values without changing valid siblings", () => {
    expect(
      normalizeSessionAudioDefaultsByType({
        focus: { guidanceVoice: "none", backgroundAudio: "broken" },
        deep_prime: { guidanceVoice: "male", backgroundAudio: "off" },
      }),
    ).toEqual({
      focus: { guidanceVoice: "none", backgroundAudio: "ambient" },
      deep_prime: { guidanceVoice: "male", backgroundAudio: "off" },
      visualize: DEFAULT_SESSION_AUDIO_DEFAULTS.visualize,
    });
  });

  it("labels immutable session snapshots by source", () => {
    expect(
      resolveSessionAudioConfiguration(DEFAULT_SESSION_AUDIO_DEFAULTS.focus),
    ).toEqual({
      ...DEFAULT_SESSION_AUDIO_DEFAULTS.focus,
      source: "default",
    });
    expect(
      resolveSessionAudioConfiguration(DEFAULT_SESSION_AUDIO_DEFAULTS.focus, {
        guidanceVoice: "none",
        backgroundAudio: "ambient",
      }),
    ).toEqual({
      guidanceVoice: "none",
      backgroundAudio: "ambient",
      source: "session_override",
    });
  });

  it.each([
    ["female", "ambient", "Female Voice · Ambient"],
    ["female", "off", "Female Voice · Silence"],
    ["male", "ambient", "Male Voice · Ambient"],
    ["male", "off", "Male Voice · Silence"],
    ["none", "ambient", "No Voice · Ambient"],
    ["none", "off", "No Voice · Silence"],
  ] as const)(
    "formats voice=%s background=%s centrally",
    (guidanceVoice, backgroundAudio, copy) => {
      expect(
        formatSessionAudioSummary({ guidanceVoice, backgroundAudio }),
      ).toBe(copy);
    },
  );
});
