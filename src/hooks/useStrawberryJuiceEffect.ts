import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated } from 'react-native';

type StrawberryJuiceEffect = {
  showStrawberryJuice: boolean;
  juiceScale: Animated.Value;
  juiceOpacity: Animated.Value;
  handleShowJuice: (show: boolean) => void;
};

export const useStrawberryJuiceEffect = (): StrawberryJuiceEffect => {
  const [showStrawberryJuice, setShowStrawberryJuice] = useState(false);
  const juiceScale = useRef(new Animated.Value(0)).current;
  const juiceOpacity = useRef(new Animated.Value(0)).current;
  const reduceMotionRef = useRef(false);
  const reducedMotionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      reduceMotionRef.current = enabled;
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      reduceMotionRef.current = enabled;
    });
    return () => {
      subscription.remove();
      if (reducedMotionTimerRef.current) {
        clearTimeout(reducedMotionTimerRef.current);
      }
      juiceScale.stopAnimation();
      juiceOpacity.stopAnimation();
    };
  }, [juiceOpacity, juiceScale]);

  const handleShowJuice = useCallback((show: boolean) => {
    setShowStrawberryJuice(show);
    if (!show) {
      return;
    }
    if (reducedMotionTimerRef.current) {
      clearTimeout(reducedMotionTimerRef.current);
      reducedMotionTimerRef.current = null;
    }
    if (reduceMotionRef.current) {
      juiceScale.setValue(1);
      juiceOpacity.setValue(0.35);
      reducedMotionTimerRef.current = setTimeout(() => {
        setShowStrawberryJuice(false);
        reducedMotionTimerRef.current = null;
      }, 250);
      return;
    }

    juiceScale.setValue(0);
    juiceOpacity.setValue(1);
    Animated.parallel([
      Animated.spring(juiceScale, {
        toValue: 1,
        useNativeDriver: true,
        tension: 50,
        friction: 7,
      }),
      Animated.timing(juiceOpacity, {
        toValue: 0,
        duration: 3_000,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        setShowStrawberryJuice(false);
        juiceScale.setValue(0);
        juiceOpacity.setValue(0);
      }
    });
  }, [juiceOpacity, juiceScale]);

  return { showStrawberryJuice, juiceScale, juiceOpacity, handleShowJuice };
};
