# Visualize guided voice clip checklist

Status: waiting for supplied recordings. Runtime TTS and synthetic substitutes are prohibited. Until mapped, Visualize uses text guidance plus optional ambient audio.

## Delivery contract

- Two voices for every clip: `female` and `male`.
- WAV master preferred (48 kHz/24-bit); app delivery format may be AAC or MP3 after QA.
- Naming: `visualize-{duration}-{phase}-{cueKey}-{voice}.mp3`.
- One-minute clips use the shortened script below. Three- and five-minute sessions reuse the same full-script recording.
- Leave no baked-in music, reverb, countdown, or silence beyond a natural breath at the tail.
- Intended timestamps are cue start times. Clips must finish before the next cue in the same phase.

## Scripts

| Phase | Cue key | 1-minute shortened script | 3/5-minute reusable script |
|---|---|---|---|
| Arrive | `attention_settle` | Let attention settle. | Let your attention settle. |
| Arrive | `notice_anchor` | Notice the anchor. | Notice the shape, the lines, and the space around it. |
| Arrive | `slow_breathing` | Slow your breath. | Allow your breathing to slow. |
| Arrive | `in_and_out` | In… and out. | In… and out. |
| See | `picture_proof` | Picture the proving moment. | Picture the exact moment that proves this intention is real. |
| See | `where_are_you` | Where are you? | Where are you? |
| See | `see_first` | What appears first? | What do you see first? |
| See | `who_present` | Who is present? | Who is present? |
| See | `notice_first` | Notice what happens first. | Notice where you are and what happens first. |
| Feel | `step_in` | Step into it. | Step into the scene. |
| Feel | `posture_breathing` | Notice posture and breath. | Notice your posture and your breathing. |
| Feel | `how_speak` | How do you speak? | How do you speak? |
| Feel | `difficulty_response` | How do you meet difficulty? | How do you respond when the moment becomes difficult? |
| Feel | `familiar_difference` | What now feels familiar? | What feels different because this is now familiar? |
| Seal | `smaller_clearer` | Make it small and clear. | Let the scene become smaller and clearer. |
| Seal | `hold_response` | Hold how you showed up. | Hold onto the way you showed up. |
| Seal | `place_in_anchor` | Place it in the anchor. | Place that feeling back into the anchor. |
| Seal | `anchor_memory` | Let the anchor remember. | Let the anchor hold the memory of this response. |
| Return | `return_room` | Return to the room. | Return your attention to the room. |
| Return | `carry_forward` | Carry this forward. | Carry this version of yourself into your next action. |
| Return | `one_thing_now` | What can you do now? | What is one thing you can do now that matches what you saw? |

## Intended cue timestamps

For every row, supply both `female` and `male` files using the naming contract above.

| Duration | Phase | Cue key | Start |
|---|---|---|---:|
| 1 min | Arrive | `attention_settle` | 0:00.8 |
| 1 min | Arrive | `notice_anchor` | 0:04.0 |
| 1 min | Arrive | `slow_breathing` | 0:07.2 |
| 1 min | Arrive | `in_and_out` | 0:08.6 |
| 1 min | See | `picture_proof` | 0:11.4 |
| 1 min | See | `where_are_you` | 0:15.1 |
| 1 min | See | `see_first` | 0:18.8 |
| 1 min | See | `who_present` | 0:22.6 |
| 1 min | See | `notice_first` | 0:25.0 |
| 1 min | Feel | `step_in` | 0:28.4 |
| 1 min | Feel | `posture_breathing` | 0:31.3 |
| 1 min | Feel | `how_speak` | 0:34.1 |
| 1 min | Feel | `difficulty_response` | 0:37.0 |
| 1 min | Feel | `familiar_difference` | 0:39.9 |
| 1 min | Seal | `smaller_clearer` | 0:44.7 |
| 1 min | Seal | `hold_response` | 0:46.7 |
| 1 min | Seal | `place_in_anchor` | 0:48.7 |
| 1 min | Seal | `anchor_memory` | 0:50.7 |
| 1 min | Return | `return_room` | 0:53.6 |
| 1 min | Return | `carry_forward` | 0:55.9 |
| 1 min | Return | `one_thing_now` | 0:58.3 |
| 3 min | Arrive | `attention_settle` | 0:02.3 |
| 3 min | Arrive | `notice_anchor` | 0:11.6 |
| 3 min | Arrive | `slow_breathing` | 0:20.9 |
| 3 min | Arrive | `in_and_out` | 0:24.9 |
| 3 min | See | `picture_proof` | 0:33.0 |
| 3 min | See | `where_are_you` | 0:44.0 |
| 3 min | See | `see_first` | 0:55.0 |
| 3 min | See | `who_present` | 1:06.0 |
| 3 min | See | `notice_first` | 1:13.0 |
| 3 min | Feel | `step_in` | 1:23.0 |
| 3 min | Feel | `posture_breathing` | 1:31.5 |
| 3 min | Feel | `how_speak` | 1:40.0 |
| 3 min | Feel | `difficulty_response` | 1:48.5 |
| 3 min | Feel | `familiar_difference` | 1:57.0 |
| 3 min | Seal | `smaller_clearer` | 2:11.3 |
| 3 min | Seal | `hold_response` | 2:17.7 |
| 3 min | Seal | `place_in_anchor` | 2:24.1 |
| 3 min | Seal | `anchor_memory` | 2:30.5 |
| 3 min | Return | `return_room` | 2:39.8 |
| 3 min | Return | `carry_forward` | 2:47.2 |
| 3 min | Return | `one_thing_now` | 2:54.7 |
| 5 min | Arrive | `attention_settle` | 0:03.8 |
| 5 min | Arrive | `notice_anchor` | 0:19.2 |
| 5 min | Arrive | `slow_breathing` | 0:34.6 |
| 5 min | Arrive | `in_and_out` | 0:41.3 |
| 5 min | See | `picture_proof` | 0:54.7 |
| 5 min | See | `where_are_you` | 1:13.2 |
| 5 min | See | `see_first` | 1:31.7 |
| 5 min | See | `who_present` | 1:50.2 |
| 5 min | See | `notice_first` | 2:01.9 |
| 5 min | Feel | `step_in` | 2:18.7 |
| 5 min | Feel | `posture_breathing` | 2:33.0 |
| 5 min | Feel | `how_speak` | 2:47.3 |
| 5 min | Feel | `difficulty_response` | 3:01.6 |
| 5 min | Feel | `familiar_difference` | 3:15.8 |
| 5 min | Seal | `smaller_clearer` | 3:39.8 |
| 5 min | Seal | `hold_response` | 3:50.4 |
| 5 min | Seal | `place_in_anchor` | 4:01.0 |
| 5 min | Seal | `anchor_memory` | 4:11.5 |
| 5 min | Return | `return_room` | 4:26.9 |
| 5 min | Return | `carry_forward` | 4:39.1 |
| 5 min | Return | `one_thing_now` | 4:51.4 |

## Mapping QA

- Confirm every manifest entry resolves on clean iOS and Android installs.
- Verify pause/resume and audio interruption never replay an already-finished cue.
- Verify ambient ducks during clips and returns smoothly afterward.
- Verify all one-minute clips finish before the next cue; re-record rather than time-stretch.
- Verify missing individual clips fall back to visible text without blocking completion.
- Screen-reader labels and visible cue text must remain identical to the manifest copy.
