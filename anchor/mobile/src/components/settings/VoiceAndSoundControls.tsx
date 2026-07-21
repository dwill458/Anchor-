import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Play, Square, Volume2, VolumeX } from "lucide-react-native";
import { colors, spacing, typography } from "@/theme";
import {
  isVoiceAvailable,
  lookupVoicePreviewTrack,
  SESSION_AUDIO_LOCALE,
} from "@/services/SessionAudioManifest";
import {
  getActivePreviewVoice,
  startVoicePreview,
  stopVoicePreview,
  subscribeToVoicePreview,
} from "@/services/VoicePreviewService";
import {
  formatSessionAudioSummary,
  type GuidanceVoice,
  type SessionAudioDefaults,
  type SessionAudioSessionType,
} from "@/types/sessionAudio";

type Props = {
  value: SessionAudioDefaults;
  onChange: (value: SessionAudioDefaults) => void;
  sessionType: SessionAudioSessionType;
  durationSeconds: number;
  showHeading?: boolean;
  showPreview?: boolean;
};

const VOICE_OPTIONS: Array<{
  voice: GuidanceVoice;
  label: string;
  description: string;
}> = [
  {
    voice: "female",
    label: "Female Voice",
    description: "Warm, calm guidance",
  },
  {
    voice: "male",
    label: "Male Voice",
    description: "Grounded, steady guidance",
  },
  {
    voice: "none",
    label: "No Voice",
    description: "Visual and haptic guidance only",
  },
];

export const VoiceAndSoundControls: React.FC<Props> = ({
  value,
  onChange,
  sessionType,
  durationSeconds,
  showHeading = true,
  showPreview = true,
}) => {
  const [activePreviewVoice, setActivePreviewVoice] = useState(
    getActivePreviewVoice(),
  );
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToVoicePreview(setActivePreviewVoice);
    return () => {
      unsubscribe();
      stopVoicePreview();
    };
  }, []);

  const availability = useMemo(
    () =>
      new Map(
        VOICE_OPTIONS.map((option) => [
          option.voice,
          isVoiceAvailable({
            voice: option.voice,
            sessionType,
            durationSeconds,
            locale: SESSION_AUDIO_LOCALE,
          }),
        ]),
      ),
    [durationSeconds, sessionType],
  );

  const handlePreview = async (voice: Exclude<GuidanceVoice, "none">) => {
    setPreviewError(null);
    if (activePreviewVoice === voice) {
      stopVoicePreview();
      return;
    }

    const started = await startVoicePreview(voice);
    if (!started) {
      setPreviewError(
        `${voice === "female" ? "Female" : "Male"} preview is unavailable.`,
      );
    }
  };

  return (
    <View style={styles.container}>
      {showHeading ? (
        <View style={styles.headingBlock}>
          <Text style={styles.heading}>Voice & Sound</Text>
          <Text style={styles.description}>
            Choose guidance and background sound independently.
          </Text>
        </View>
      ) : null}

      <Text style={styles.groupLabel}>Guidance Voice</Text>
      <View accessibilityRole="radiogroup" style={styles.voiceList}>
        {VOICE_OPTIONS.map((option) => {
          const selected = value.guidanceVoice === option.voice;
          const available = availability.get(option.voice) === true;
          const hasPreview =
            option.voice !== "none" &&
            lookupVoicePreviewTrack(option.voice) != null;
          const unavailableReason =
            option.voice === "male"
              ? "Male voice clips are coming soon for this session."
              : "Guidance is unavailable for this duration.";

          return (
            <View
              key={option.voice}
              style={[
                styles.voiceRow,
                selected && styles.selectedRow,
                !available && styles.unavailableRow,
              ]}
            >
              <TouchableOpacity
                accessibilityRole="radio"
                accessibilityLabel={`${option.label}. ${option.description}`}
                accessibilityHint={available ? undefined : unavailableReason}
                accessibilityState={{ selected, disabled: !available }}
                activeOpacity={0.82}
                disabled={!available}
                onPress={() =>
                  onChange({ ...value, guidanceVoice: option.voice })
                }
                style={styles.voiceChoice}
              >
                <View style={[styles.radio, selected && styles.radioSelected]}>
                  {selected ? <View style={styles.radioDot} /> : null}
                </View>
                <View style={styles.voiceCopy}>
                  <View style={styles.voiceTitleRow}>
                    <Text
                      style={[
                        styles.voiceTitle,
                        !available && styles.unavailableText,
                      ]}
                    >
                      {option.label}
                    </Text>
                    {!available ? (
                      <Text style={styles.unavailableBadge}>Unavailable</Text>
                    ) : null}
                  </View>
                  <Text
                    style={[
                      styles.voiceDescription,
                      !available && styles.unavailableText,
                    ]}
                  >
                    {option.description}
                  </Text>
                </View>
              </TouchableOpacity>

              {showPreview && option.voice !== "none" ? (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={`${activePreviewVoice === option.voice ? "Stop" : "Play"} ${option.voice === "female" ? "Female" : "Male"} voice preview`}
                  accessibilityState={{ disabled: !available || !hasPreview }}
                  activeOpacity={0.82}
                  disabled={!available || !hasPreview}
                  onPress={() =>
                    void handlePreview(
                      option.voice as Exclude<GuidanceVoice, "none">,
                    )
                  }
                  style={[
                    styles.previewButton,
                    (!available || !hasPreview) && styles.previewButtonDisabled,
                  ]}
                >
                  {activePreviewVoice === option.voice ? (
                    <Square color={colors.gold} fill={colors.gold} size={12} />
                  ) : (
                    <Play
                      color={
                        available && hasPreview ? colors.gold : colors.silver
                      }
                      size={14}
                    />
                  )}
                  <Text
                    style={[
                      styles.previewText,
                      (!available || !hasPreview) && styles.unavailableText,
                    ]}
                  >
                    {activePreviewVoice === option.voice ? "Stop" : "Preview"}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          );
        })}
      </View>
      {previewError ? (
        <Text accessibilityRole="alert" style={styles.previewError}>
          {previewError}
        </Text>
      ) : null}

      <Text style={[styles.groupLabel, styles.backgroundLabel]}>
        Background
      </Text>
      <View accessibilityRole="radiogroup" style={styles.backgroundGrid}>
        <TouchableOpacity
          accessibilityRole="radio"
          accessibilityLabel="Ambient background"
          accessibilityState={{ selected: value.backgroundAudio === "ambient" }}
          activeOpacity={0.82}
          onPress={() => onChange({ ...value, backgroundAudio: "ambient" })}
          style={[
            styles.backgroundButton,
            value.backgroundAudio === "ambient" && styles.selectedRow,
          ]}
        >
          <Volume2
            color={
              value.backgroundAudio === "ambient" ? colors.gold : colors.silver
            }
            size={17}
          />
          <Text
            style={[
              styles.backgroundText,
              value.backgroundAudio === "ambient" && styles.selectedText,
            ]}
          >
            Ambient
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="radio"
          accessibilityLabel="Silence background"
          accessibilityState={{ selected: value.backgroundAudio === "off" }}
          activeOpacity={0.82}
          onPress={() => onChange({ ...value, backgroundAudio: "off" })}
          style={[
            styles.backgroundButton,
            value.backgroundAudio === "off" && styles.selectedRow,
          ]}
        >
          <VolumeX
            color={
              value.backgroundAudio === "off" ? colors.gold : colors.silver
            }
            size={17}
          />
          <Text
            style={[
              styles.backgroundText,
              value.backgroundAudio === "off" && styles.selectedText,
            ]}
          >
            Silence
          </Text>
        </TouchableOpacity>
      </View>

      <View
        accessible
        accessibilityLabel={`Current experience: ${formatSessionAudioSummary(value)}`}
        style={styles.summary}
      >
        <Volume2 color={colors.gold} size={16} />
        <View style={styles.summaryCopy}>
          <Text style={styles.summaryLabel}>Current experience</Text>
          <Text style={styles.summaryText}>
            {formatSessionAudioSummary(value)}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  headingBlock: { gap: 4, marginBottom: 2 },
  heading: {
    color: colors.gold,
    fontFamily: typography.fonts.heading,
    fontSize: 18,
    letterSpacing: 0.5,
  },
  description: {
    color: "rgba(229,229,229,0.68)",
    fontSize: 13,
    lineHeight: 19,
  },
  groupLabel: {
    color: colors.silver,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.9,
    marginTop: 4,
    textTransform: "uppercase",
  },
  voiceList: { gap: 8 },
  voiceRow: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.035)",
    borderColor: "rgba(192,192,192,0.16)",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    minHeight: 64,
    paddingRight: 8,
  },
  selectedRow: {
    backgroundColor: "rgba(212,175,55,0.09)",
    borderColor: "rgba(212,175,55,0.58)",
  },
  unavailableRow: { opacity: 0.7 },
  voiceChoice: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    minHeight: 62,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  radio: {
    alignItems: "center",
    borderColor: "rgba(192,192,192,0.55)",
    borderRadius: 9,
    borderWidth: 1.5,
    height: 18,
    justifyContent: "center",
    marginRight: 11,
    width: 18,
  },
  radioSelected: { borderColor: colors.gold },
  radioDot: {
    backgroundColor: colors.gold,
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  voiceCopy: { flex: 1, gap: 2 },
  voiceTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },
  voiceTitle: { color: "#F2F0EA", fontSize: 14, fontWeight: "700" },
  voiceDescription: {
    color: "rgba(229,229,229,0.6)",
    fontSize: 12,
    lineHeight: 17,
  },
  unavailableText: { color: "rgba(192,192,192,0.5)" },
  unavailableBadge: {
    color: "rgba(212,175,55,0.72)",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  previewButton: {
    alignItems: "center",
    borderColor: "rgba(212,175,55,0.3)",
    borderRadius: 9,
    borderWidth: 1,
    flexDirection: "row",
    gap: 5,
    justifyContent: "center",
    minHeight: 40,
    minWidth: 82,
    paddingHorizontal: 9,
  },
  previewButtonDisabled: { borderColor: "rgba(192,192,192,0.12)" },
  previewText: { color: colors.gold, fontSize: 11, fontWeight: "700" },
  previewError: { color: "#E5A29A", fontSize: 12 },
  backgroundLabel: { marginTop: spacing.sm },
  backgroundGrid: { flexDirection: "row", gap: 10 },
  backgroundButton: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.035)",
    borderColor: "rgba(192,192,192,0.16)",
    borderRadius: 11,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: 48,
  },
  backgroundText: { color: colors.silver, fontSize: 13, fontWeight: "700" },
  selectedText: { color: colors.gold },
  summary: {
    alignItems: "center",
    backgroundColor: "rgba(212,175,55,0.06)",
    borderRadius: 11,
    flexDirection: "row",
    gap: 10,
    marginTop: spacing.sm,
    minHeight: 58,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  summaryCopy: { flex: 1, gap: 2 },
  summaryLabel: {
    color: "rgba(212,175,55,0.75)",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.7,
    textTransform: "uppercase",
  },
  summaryText: { color: "#F0EDE5", fontSize: 13, lineHeight: 18 },
});
