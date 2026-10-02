import React from 'react';
import {
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  StyleProp,
  ViewStyle,
  RefreshControlProps,
} from 'react-native';
import { SafeAreaView, Edge } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';
import { useIsOnline } from '../../query/useIsOnline';
import { useI18n } from '../../i18n';
import { Banner } from './Banner';

export interface ScreenContainerProps {
  children: React.ReactNode;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  showOfflineBanner?: boolean;
  /**
   * When false the children are not wrapped in a ScrollView and fill the available height.
   * Use this for screens whose main content is a FlatList/SectionList, so the list is the
   * scroll container (a VirtualizedList inside a plain ScrollView loses windowing).
   */
  scrollable?: boolean;
  /** When false the content area has no built-in padding (the screen lays itself out). */
  padded?: boolean;
  testID?: string;
  refreshControl?: React.ReactElement<RefreshControlProps>;
  edges?: readonly Edge[];
}

export function ScreenContainer({
  children,
  header,
  footer,
  style,
  contentContainerStyle,
  showOfflineBanner = true,
  scrollable = true,
  padded = true,
  testID,
  refreshControl,
  edges = ['top', 'left', 'right', 'bottom'],
}: ScreenContainerProps) {
  const { theme } = useTheme();
  const { t } = useI18n();
  const isOnline = useIsOnline();

  const content = (
    <View
      style={[
        styles.innerContainer,
        !padded && styles.unpadded,
        !scrollable && styles.fill,
        contentContainerStyle,
      ]}
    >
      {showOfflineBanner && !isOnline ? (
        <View style={padded ? undefined : styles.unpaddedBanner}>
          <Banner
            tone="warning"
            title={t('offline.title')}
            message={t('auth.offline.banner')}
            testID="offline-banner"
          />
        </View>
      ) : null}
      {children}
    </View>
  );

  return (
    <SafeAreaView
      edges={edges}
      style={[styles.safeArea, { backgroundColor: theme.colors.bg }, style]}
      testID={testID}
    >
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {header ? <View style={styles.headerContainer}>{header}</View> : null}

        {scrollable ? (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            refreshControl={refreshControl}
          >
            {content}
          </ScrollView>
        ) : (
          content
        )}

        {footer ? <View style={styles.footerContainer}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  keyboardAvoid: {
    flex: 1,
  },
  headerContainer: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  innerContainer: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  unpadded: {
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  unpaddedBanner: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  // Non-scrolling mode: without flex the content collapses to its intrinsic height, which
  // gives an inner flex:1 list zero height.
  fill: {
    flex: 1,
  },
  footerContainer: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
});
