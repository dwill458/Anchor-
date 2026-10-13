import importlib.util
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location("analyze_framestats", Path(__file__).with_name("analyze-framestats.py"))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
summarize = module.summarize


def dump(rows, header="Flags,IntendedVsync,FrameCompleted,FrameDeadline", prefix=""):
    return prefix + "\n---PROFILEDATA---\n" + header + "\n" + rows + "\n---PROFILEDATA---"


class FrameEvidenceTests(unittest.TestCase):
    def test_platform_totals_are_not_ring_sample_counts(self):
        result = summarize(dump(
            "0,10000000,20000000,26000000\n0,30000000,50000000,46000000",
            prefix="Total frames rendered: 999\nJanky frames: 9 (0.90%)",
        ))
        self.assertEqual(result["platform_total_frames"], 999)
        self.assertEqual(result["retained_valid_frames"], 2)
        self.assertEqual(result["retained_frame_ms"]["p50"], 15)
        self.assertEqual(result["retained_completed_after_deadline"], 1)

    def test_flagged_and_unfinished_frames_do_not_bias_distribution(self):
        result = summarize(dump(
            "1,10000000,1000000000,26000000\n"
            "0,30000000,9223372036854775807,46000000\n"
            "0,50000000,40000000,66000000\n"
            "0,70000000,80000000,86000000"
        ))
        self.assertEqual(result["retained_valid_frames"], 1)
        self.assertEqual(result["excluded_flagged_frames"], 1)
        self.assertEqual(result["excluded_invalid_frames"], 2)
        self.assertEqual(result["retained_frame_ms"]["max"], 10)

    def test_malformed_deadline_cannot_count_same_row_as_valid_and_excluded(self):
        result = summarize(dump("0,10000000,20000000,not-a-time"))
        self.assertEqual(result["retained_valid_frames"], 0)
        self.assertEqual(result["excluded_invalid_frames"], 1)
        self.assertIsNone(result["retained_frame_ms"])

    def test_older_headers_do_not_invent_deadline_or_fps_measurements(self):
        result = summarize(dump("0,10000000,20000000", header="Flags,IntendedVsync,FrameCompleted"))
        self.assertEqual(result["retained_valid_frames"], 1)
        self.assertEqual(result["retained_deadline_comparable_frames"], 0)
        self.assertNotIn("fps", result)


if __name__ == "__main__":
    unittest.main()
