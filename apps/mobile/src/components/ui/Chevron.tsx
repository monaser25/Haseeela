import React from 'react';
import { I18nManager } from 'react-native';
import { ChevronRight } from 'lucide-react-native';

export interface ChevronProps {
  size?: number;
  color: string;
  testID?: string;
}

/**
 * "Go forward" chevron. SVG icons do not mirror with the layout direction on their own, so it is
 * flipped horizontally when the app is running RTL.
 */
export function Chevron({ size = 18, color, testID }: ChevronProps) {
  return (
    <ChevronRight
      size={size}
      color={color}
      testID={testID}
      style={I18nManager.isRTL ? { transform: [{ scaleX: -1 }] } : undefined}
    />
  );
}
