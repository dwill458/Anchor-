import { DEFAULT_SESSION_AUDIO_DEFAULTS } from "@/types/sessionAudio";
import { useSettingsStore } from "../settingsStore";

describe("settingsStore Voice & Sound ownership", () => {
  beforeEach(() => {
    useSettingsStore.setState({
      sessionAudioDefaults: {
        focus: { ...DEFAULT_SESSION_AUDIO_DEFAULTS.focus },
        deep_prime: { ...DEFAULT_SESSION_AUDIO_DEFAULTS.deep_prime },
        visualize: { ...DEFAULT_SESSION_AUDIO_DEFAULTS.visualize },
      },
      sessionAudioDefaultsOwnerUserId: null,
      sessionAudioDefaultsOwnerInitialized: false,
      sessionAudioDefaultsUpdatedAt: null,
      lastSessionDurationByMode: { focus: 30, deep_prime: 120, visualize: 180 },
      lastSessionDurationOwnerUserId: null,
    });
  });

  it("persists the two session types independently", () => {
    useSettingsStore
      .getState()
      .setSessionAudioDefaults(
        "focus",
        { guidanceVoice: "none", backgroundAudio: "ambient" },
        "user-a",
      );
    expect(useSettingsStore.getState().sessionAudioDefaults).toEqual({
      focus: { guidanceVoice: "none", backgroundAudio: "ambient" },
      deep_prime: DEFAULT_SESSION_AUDIO_DEFAULTS.deep_prime,
      visualize: DEFAULT_SESSION_AUDIO_DEFAULTS.visualize,
    });
  });

  it("clears account-owned preferences on sign-out and account switches", () => {
    useSettingsStore
      .getState()
      .setSessionAudioDefaults(
        "deep_prime",
        { guidanceVoice: "none", backgroundAudio: "off" },
        "user-a",
      );
    useSettingsStore.getState().bindSessionAudioDefaultsOwner(null);
    expect(useSettingsStore.getState().sessionAudioDefaults).toEqual(
      DEFAULT_SESSION_AUDIO_DEFAULTS,
    );
    useSettingsStore.getState().bindSessionAudioDefaultsOwner("user-b");
    expect(useSettingsStore.getState().sessionAudioDefaultsOwnerUserId).toBe(
      "user-b",
    );
    expect(useSettingsStore.getState().sessionAudioDefaults).toEqual(
      DEFAULT_SESSION_AUDIO_DEFAULTS,
    );
  });

  it("keeps recent Visualize duration account-scoped without changing its global default", () => {
    useSettingsStore.getState().bindSessionAudioDefaultsOwner("user-a");
    useSettingsStore.getState().setLastSessionDuration("visualize", 300);
    expect(
      useSettingsStore.getState().lastSessionDurationByMode.visualize,
    ).toBe(300);
    expect(useSettingsStore.getState().visualizeSessionDuration).toBe(180);

    useSettingsStore.getState().bindSessionAudioDefaultsOwner("user-b");
    expect(
      useSettingsStore.getState().lastSessionDurationByMode.visualize,
    ).toBe(180);
    expect(useSettingsStore.getState().lastSessionDurationOwnerUserId).toBe(
      "user-b",
    );
  });

  it("rejects remote preferences for the wrong account", () => {
    useSettingsStore.getState().bindSessionAudioDefaultsOwner("user-a");
    const result = useSettingsStore.getState().applyRemoteSessionAudioDefaults({
      ownerUserId: "user-b",
      defaults: {
        focus: { guidanceVoice: "none", backgroundAudio: "off" },
        deep_prime: { guidanceVoice: "none", backgroundAudio: "off" },
        visualize: { guidanceVoice: "none", backgroundAudio: "off" },
      },
      updatedAt: "2026-07-19T12:00:00.000Z",
    });
    expect(result).toBe("wrong_account");
    expect(useSettingsStore.getState().sessionAudioDefaults).toEqual(
      DEFAULT_SESSION_AUDIO_DEFAULTS,
    );
  });

  it("keeps a newer offline local edit over stale remote data", () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-07-19T12:00:00.000Z"));
    useSettingsStore
      .getState()
      .setSessionAudioDefaults(
        "focus",
        { guidanceVoice: "none", backgroundAudio: "off" },
        "user-a",
      );
    const result = useSettingsStore.getState().applyRemoteSessionAudioDefaults({
      ownerUserId: "user-a",
      defaults: DEFAULT_SESSION_AUDIO_DEFAULTS,
      updatedAt: "2026-07-19T11:59:00.000Z",
    });
    expect(result).toBe("local_newer");
    expect(useSettingsStore.getState().sessionAudioDefaults.focus).toEqual({
      guidanceVoice: "none",
      backgroundAudio: "off",
    });
    jest.useRealTimers();
  });
});
