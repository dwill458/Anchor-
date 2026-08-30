import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { VoiceAndSoundControls } from "../VoiceAndSoundControls";

const mockStartVoicePreview = jest.fn();
const mockStopVoicePreview = jest.fn();

jest.mock("@/services/VoicePreviewService", () => ({
  getActivePreviewVoice: jest.fn(() => null),
  startVoicePreview: (...args: unknown[]) => mockStartVoicePreview(...args),
  stopVoicePreview: () => mockStopVoicePreview(),
  subscribeToVoicePreview: jest.fn((listener: (voice: null) => void) => {
    listener(null);
    return jest.fn();
  }),
}));

describe("VoiceAndSoundControls", () => {
  beforeEach(() => jest.clearAllMocks());

  it("changes guidance and ambient sound independently", () => {
    const onChange = jest.fn();
    render(
      <VoiceAndSoundControls
        value={{ guidanceVoice: "female", backgroundAudio: "ambient" }}
        onChange={onChange}
        sessionType="focus"
        durationSeconds={30}
      />,
    );

    fireEvent.press(
      screen.getByLabelText("No Voice. Visual and haptic guidance only"),
    );
    expect(onChange).toHaveBeenCalledWith({
      guidanceVoice: "none",
      backgroundAudio: "ambient",
    });

    fireEvent.press(screen.getByLabelText("Silence background"));
    expect(onChange).toHaveBeenCalledWith({
      guidanceVoice: "female",
      backgroundAudio: "off",
    });
  });

  it("selects Female from a no-voice configuration and updates the summary", () => {
    const onChange = jest.fn();
    render(
      <VoiceAndSoundControls
        value={{ guidanceVoice: "none", backgroundAudio: "off" }}
        onChange={onChange}
        sessionType="focus"
        durationSeconds={30}
      />,
    );
    expect(screen.getByText("No Voice · Silence")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Female Voice. Warm, calm guidance"));
    expect(onChange).toHaveBeenCalledWith({
      guidanceVoice: "female",
      backgroundAudio: "off",
    });
  });

  it("selects the available Male voice independently", () => {
    const onChange = jest.fn();
    render(
      <VoiceAndSoundControls
        value={{ guidanceVoice: "female", backgroundAudio: "off" }}
        onChange={onChange}
        sessionType="deep_prime"
        durationSeconds={300}
      />,
    );

    const male = screen.getByLabelText("Male Voice. Grounded, steady guidance");
    expect(male.props.accessibilityState).toEqual({ selected: false, disabled: false });
    fireEvent.press(male);
    expect(onChange).toHaveBeenCalledWith({
      guidanceVoice: "male",
      backgroundAudio: "off",
    });
  });

  it("starts the available female preview", async () => {
    mockStartVoicePreview.mockResolvedValue(true);
    render(
      <VoiceAndSoundControls
        value={{ guidanceVoice: "female", backgroundAudio: "ambient" }}
        onChange={jest.fn()}
        sessionType="focus"
        durationSeconds={30}
      />,
    );

    fireEvent.press(screen.getByLabelText("Play Female voice preview"));
    expect(mockStartVoicePreview).toHaveBeenCalledWith("female");
  });

  it("starts the available male preview", async () => {
    mockStartVoicePreview.mockResolvedValue(true);
    render(
      <VoiceAndSoundControls
        value={{ guidanceVoice: "male", backgroundAudio: "ambient" }}
        onChange={jest.fn()}
        sessionType="focus"
        durationSeconds={30}
      />,
    );

    fireEvent.press(screen.getByLabelText("Play Male voice preview"));
    expect(mockStartVoicePreview).toHaveBeenCalledWith("male");
  });
});
