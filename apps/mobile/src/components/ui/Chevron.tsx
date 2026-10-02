import React from 'react';
import { View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { useIsRTL } from '../../i18n';

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
  const isRTL = useIsRTL();
  return (
    <View style={isRTL ? { transform: [{ scaleX: -1 }] } : undefined}>
      <ChevronRight size={size} color={color} testID={testID} />
    </View>
  );
}
