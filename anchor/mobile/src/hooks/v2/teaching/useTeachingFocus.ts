import { useContext, useEffect, useState } from 'react';
import { NavigationContext } from '@react-navigation/native';
import { V2_TRANSITION_SETTLE_MS } from '@/navigation/v2/transitions';

/** Standalone development hosts have no navigator; routed screens follow their real focus. */
export function useTeachingFocus() {
  const navigation = useContext(NavigationContext);
  const [focused, setFocused] = useState(() => navigation?.isFocused() ?? true);
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const focus = () => {
      setFocused(true);
      setSettled(false);
      clearTimeout(timer);
      timer = setTimeout(() => setSettled(true), V2_TRANSITION_SETTLE_MS);
    };
    const blur = () => { clearTimeout(timer); setFocused(false); setSettled(false); };
    if (navigation?.isFocused() ?? true) focus();
    const offFocus = navigation?.addListener('focus', focus);
    const offBlur = navigation?.addListener('blur', blur);
    return () => { clearTimeout(timer); offFocus?.(); offBlur?.(); };
  }, [navigation]);
  return { isFocused: focused, transitioning: !settled };
}
