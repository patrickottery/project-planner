import { useRef, useCallback } from "react";

export function useDebounce(fn, delay) {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const timer = useRef(null);
  return useCallback((...args) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => fnRef.current(...args), delay);
  }, [delay]);
}
