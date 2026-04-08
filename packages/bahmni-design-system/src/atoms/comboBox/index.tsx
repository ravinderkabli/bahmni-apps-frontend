import {
  ComboBox as CarbonComboBox,
  ComboBoxProps as CarbonComboBoxProps,
} from '@carbon/react';
import { useEffect, useRef, useState } from 'react';

export type ComboBoxProps<T> = CarbonComboBoxProps<T> & {
  testId?: string;
  'data-testid'?: string;
  clearSelectedOnChange?: boolean;
};

export const ComboBox = <T,>({
  testId,
  'data-testid': dataTestId,
  selectedItem: externalSelectedItem,
  clearSelectedOnChange = false,
  ...carbonProps
}: ComboBoxProps<T>) => {
  const [displayItem, setDisplayItem] = useState<T | null>(
    (externalSelectedItem as T) || null,
  );
  const clearTimerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    setDisplayItem((externalSelectedItem as T) || null);

    if (clearSelectedOnChange && externalSelectedItem) {
      // Use setTimeout (macrotask) instead of queueMicrotask so the browser
      // can complete the current paint cycle and deliver pending ResizeObserver
      // notifications before the second render clears the input. This prevents
      // the "ResizeObserver loop completed with undelivered notifications" error
      // that queueMicrotask caused by stacking two layout changes in one frame.
      clearTimeout(clearTimerRef.current);
      clearTimerRef.current = setTimeout(() => setDisplayItem(null), 0);
    }

    return () => clearTimeout(clearTimerRef.current);
  }, [externalSelectedItem, clearSelectedOnChange]);

  return (
    <CarbonComboBox<T>
      {...carbonProps}
      selectedItem={displayItem}
      data-testid={testId ?? dataTestId}
    />
  );
};
