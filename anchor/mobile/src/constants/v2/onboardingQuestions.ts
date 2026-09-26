import type { AnchorCategory } from "@/types";

export interface OnboardingQuestionOption {
  id: string;
  label: string;
}

export interface CategoryQuestions {
  outcome: readonly OnboardingQuestionOption[];
  why: readonly OnboardingQuestionOption[];
  friction: readonly OnboardingQuestionOption[];
}

export const ONBOARDING_QUESTIONS: Record<AnchorCategory, CategoryQuestions> = {
  health: {
    outcome: [
      { id: "health_more_energy", label: "More energy" },
      { id: "health_more_confidence", label: "More confidence" },
      { id: "health_more_strength", label: "More strength" },
      { id: "health_healthier_life", label: "A healthier life" },
    ],
    why: [
      { id: "health_why_myself_again", label: "I want to feel like myself again" },
      { id: "health_why_show_up_better", label: "I want to show up better every day" },
      { id: "health_why_stop_putting_off", label: "I’m ready to stop putting this off" },
      { id: "health_why_capable_of", label: "I want to see what I’m capable of" },
    ],
    friction: [
      { id: "health_friction_lose_momentum", label: "I lose momentum" },
      { id: "health_friction_stay_consistent", label: "I struggle to stay consistent" },
      { id: "health_friction_life_crowded", label: "Life gets crowded" },
      { id: "health_friction_old_habits", label: "I fall back into old habits" },
    ],
  },
  career: {
    outcome: [
      { id: "career_more_freedom", label: "More freedom" },
      { id: "career_more_confidence", label: "More confidence" },
      { id: "career_more_opportunity", label: "More opportunity" },
      { id: "career_work_proud_of", label: "Work I’m proud of" },
    ],
    why: [
      { id: "career_why_more_from_work", label: "I want more from my work" },
      { id: "career_why_more_freedom", label: "I want more freedom" },
      { id: "career_why_prove_to_myself", label: "I’m ready to prove this to myself" },
      { id: "career_why_build_bigger", label: "I want to build something bigger" },
    ],
    friction: [
      { id: "career_friction_overthink", label: "I overthink my next move" },
      { id: "career_friction_lose_momentum", label: "I lose momentum" },
      { id: "career_friction_other_priorities", label: "Other priorities take over" },
      { id: "career_friction_comfort_zone", label: "I stay in my comfort zone" },
    ],
  },
  relationships: {
    outcome: [
      { id: "relationships_more_connection", label: "More connection" },
      { id: "relationships_more_trust", label: "More trust" },
      { id: "relationships_better_comm", label: "Better communication" },
      { id: "relationships_stronger_rel", label: "A stronger relationship" },
    ],
    why: [
      { id: "relationships_why_feel_closer", label: "I want us to feel closer" },
      { id: "relationships_why_stop_disconnected", label: "I want to stop feeling disconnected" },
      { id: "relationships_why_too_much_to_neglect", label: "This relationship matters too much to neglect" },
      { id: "relationships_why_show_up_better", label: "I want to show up better for them" },
    ],
    friction: [
      { id: "relationships_friction_same_patterns", label: "We get caught in the same patterns" },
      { id: "relationships_friction_too_busy", label: "Life gets too busy" },
      { id: "relationships_friction_avoid_difficult", label: "I avoid difficult conversations" },
      { id: "relationships_friction_stop_intentional", label: "I stop being intentional" },
    ],
  },
  creativity: {
    outcome: [
      { id: "creativity_more_inspiration", label: "More inspiration" },
      { id: "creativity_more_confidence", label: "More confidence in my ideas" },
      { id: "creativity_more_consistency", label: "More consistency" },
      { id: "creativity_something_proud", label: "Something I’m proud to create" },
    ],
    why: [
      { id: "creativity_why_miss_making", label: "I miss making things that feel like me" },
      { id: "creativity_why_tired_unfinished", label: "I’m tired of leaving ideas unfinished" },
      { id: "creativity_why_trust_creativity", label: "I want to trust my creativity again" },
      { id: "creativity_why_make_something_real", label: "I want to finally make something real" },
    ],
    friction: [
      { id: "creativity_friction_overthink", label: "I overthink everything" },
      { id: "creativity_friction_lose_momentum", label: "I lose momentum" },
      { id: "creativity_friction_wait_inspiration", label: "I wait for inspiration" },
      { id: "creativity_friction_life_crowded", label: "Life gets crowded" },
    ],
  },
  spirituality: {
    outcome: [
      { id: "spirituality_more_peace", label: "More peace" },
      { id: "spirituality_more_clarity", label: "More clarity" },
      { id: "spirituality_deeper_connection", label: "A deeper connection" },
      { id: "spirituality_stronger_purpose", label: "A stronger sense of purpose" },
    ],
    why: [
      { id: "spirituality_why_grounded", label: "I want to feel grounded again" },
      { id: "spirituality_why_meaning_in_days", label: "I want more meaning in my days" },
      { id: "spirituality_why_reconnect", label: "I want to reconnect with myself" },
      { id: "spirituality_why_live_intention", label: "I want to live with more intention" },
    ],
    friction: [
      { id: "spirituality_friction_distracted", label: "I get distracted" },
      { id: "spirituality_friction_lose_consistency", label: "I lose consistency" },
      { id: "spirituality_friction_daily_takes_over", label: "Daily life takes over" },
      { id: "spirituality_friction_forget_matters", label: "I forget what matters" },
    ],
  },
  abundance: {
    outcome: [
      { id: "abundance_more_financial_freedom", label: "More financial freedom" },
      { id: "abundance_more_stability", label: "More stability" },
      { id: "abundance_more_opportunity", label: "More opportunity" },
      { id: "abundance_control_future", label: "More control over my future" },
    ],
    why: [
      { id: "abundance_why_feel_secure", label: "I want to feel secure" },
      { id: "abundance_why_freedom_over_life", label: "I want more freedom over my life" },
      { id: "abundance_why_tired_limited", label: "I’m tired of feeling limited by money" },
      { id: "abundance_why_create_options", label: "I want to create more options for my future" },
    ],
    friction: [
      { id: "abundance_friction_lose_focus", label: "I lose focus" },
      { id: "abundance_friction_discouraged", label: "I get discouraged" },
      { id: "abundance_friction_short_term", label: "Short-term needs take over" },
      { id: "abundance_friction_dont_know_next", label: "I don’t know what move to make next" },
    ],
  },
  family: {
    outcome: [
      { id: "family_more_connection", label: "More connection" },
      { id: "family_quality_time", label: "More quality time" },
      { id: "family_stronger_bond", label: "A stronger family bond" },
      { id: "family_better_future", label: "A better future together" },
    ],
    why: [
      { id: "family_why_more_present", label: "I want to be more present" },
      { id: "family_why_feel_closer", label: "I want us to feel closer" },
      { id: "family_why_better_future", label: "I want to create a better future together" },
      { id: "family_why_not_take_for_granted", label: "I don’t want to take this time for granted" },
    ],
    friction: [
      { id: "family_friction_too_busy", label: "Life gets too busy" },
      { id: "family_friction_distracted", label: "I get distracted" },
      { id: "family_friction_more_time_later", label: "I assume there will be more time later" },
      { id: "family_friction_stay_present", label: "I struggle to stay present" },
    ],
  },
  learning: {
    outcome: [
      { id: "learning_more_knowledge", label: "More knowledge" },
      { id: "learning_more_confidence", label: "More confidence" },
      { id: "learning_better_skills", label: "Better skills" },
      { id: "learning_real_progress", label: "Real progress" },
    ],
    why: [
      { id: "learning_why_master_this", label: "I want to prove I can master this" },
      { id: "learning_why_options_future", label: "I want more options in my future" },
      { id: "learning_why_tired_stuck", label: "I’m tired of feeling stuck" },
      { id: "learning_why_keep_growing", label: "I want to keep growing" },
    ],
    friction: [
      { id: "learning_friction_lose_consistency", label: "I lose consistency" },
      { id: "learning_friction_overwhelmed", label: "I get overwhelmed" },
      { id: "learning_friction_procrastinate", label: "I procrastinate" },
      { id: "learning_friction_dont_know_focus", label: "I don’t know what to focus on next" },
    ],
  },
  adventure: {
    outcome: [
      { id: "adventure_more_freedom", label: "More freedom" },
      { id: "adventure_more_excitement", label: "More excitement" },
      { id: "adventure_new_experiences", label: "New experiences" },
      { id: "adventure_life_bigger", label: "A life that feels bigger" },
    ],
    why: [
      { id: "adventure_why_not_repetitive", label: "I don’t want life to feel repetitive" },
      { id: "adventure_why_stories_remembering", label: "I want more stories worth remembering" },
      { id: "adventure_why_alive_curious", label: "I want to feel alive and curious again" },
      { id: "adventure_why_experience_while_can", label: "I want to experience more while I can" },
    ],
    friction: [
      { id: "adventure_friction_putting_off", label: "I keep putting it off" },
      { id: "adventure_friction_responsibilities", label: "Work and responsibilities take over" },
      { id: "adventure_friction_overthink_logistics", label: "I overthink the logistics" },
      { id: "adventure_friction_stay_familiar", label: "I stay with what feels familiar" },
    ],
  },
  desire: {
    outcome: [
      { id: "desire_deeply_want", label: "Something I deeply want" },
      { id: "desire_confidence_pursue", label: "More confidence to pursue it" },
      { id: "desire_courage_after_it", label: "The courage to go after it" },
      { id: "desire_make_it_real", label: "To finally make it real" },
    ],
    why: [
      { id: "desire_why_thinking_reason", label: "I keep thinking about it for a reason" },
      { id: "desire_why_not_keep_waiting", label: "I don’t want to keep waiting" },
      { id: "desire_why_prove_possible", label: "I want to prove this is possible for me" },
      { id: "desire_why_regret_not_going", label: "I’ll regret not going after it" },
    ],
    friction: [
      { id: "desire_friction_lose_focus", label: "I lose focus" },
      { id: "desire_friction_doubt_myself", label: "I doubt myself" },
      { id: "desire_friction_waiting_right_time", label: "I keep waiting for the right time" },
      { id: "desire_friction_life_crowded", label: "Life gets crowded" },
    ],
  },
  custom: {
    outcome: [
      { id: "custom_more_clarity", label: "More clarity" },
      { id: "custom_more_confidence", label: "More confidence" },
      { id: "custom_more_momentum", label: "More momentum" },
      { id: "custom_meaningful_change", label: "A meaningful change" },
    ],
    why: [
      { id: "custom_why_mind_for_while", label: "This has been on my mind for a while" },
      { id: "custom_why_ready_change", label: "I’m ready for something to change" },
      { id: "custom_why_prove_to_myself", label: "I want to prove this to myself" },
      { id: "custom_why_not_putting_off", label: "I don’t want to keep putting it off" },
    ],
    friction: [
      { id: "custom_friction_lose_focus", label: "I lose focus" },
      { id: "custom_friction_lose_momentum", label: "I lose momentum" },
      { id: "custom_friction_overthink", label: "I overthink it" },
      { id: "custom_friction_life_crowded", label: "Life gets crowded" },
    ],
  },
};

export function outcomeOptionsFor(category?: AnchorCategory | null): readonly OnboardingQuestionOption[] {
  return ONBOARDING_QUESTIONS[category ?? "custom"]?.outcome ?? ONBOARDING_QUESTIONS.custom.outcome;
}

export function whyOptionsFor(category?: AnchorCategory | null): readonly OnboardingQuestionOption[] {
  return ONBOARDING_QUESTIONS[category ?? "custom"]?.why ?? ONBOARDING_QUESTIONS.custom.why;
}

export function frictionOptionsFor(category?: AnchorCategory | null): readonly OnboardingQuestionOption[] {
  return ONBOARDING_QUESTIONS[category ?? "custom"]?.friction ?? ONBOARDING_QUESTIONS.custom.friction;
}
