import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Platform,
  StyleSheet,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Calendar } from 'lucide-react-native';
import { useTheme } from '../../theme';
import { useI18n } from '../../i18n';
import { normalizeCalendarDate } from '../../utils/calendarDate';

export interface DatePickerFieldProps {
  label: string;
  value: Date;
  onChange: (date: Date) => void;
  disabled?: boolean;
  testID?: string;
}

export function DatePickerField({
  label,
  value,
  onChange,
  disabled = false,
  testID = 'date-picker-field',
}: DatePickerFieldProps) {
  const { theme } = useTheme();
  const { formatDate } = useI18n();
  const [showPicker, setShowPicker] = useState(false);

  const formattedDate = formatDate(value, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const handlePress = () => {
    if (!disabled) {
      setShowPicker(true);
    }
  };

  const handleDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowPicker(false);
    }
    if (event.type === 'set' && selectedDate) {
      onChange(normalizeCalendarDate(selectedDate));
    }
  };

  return (
    <View style={styles.container}>
      <Text style={[theme.typography.captionUpper, styles.label, { color: theme.colors.textMuted }]}>
        {label}
      </Text>

      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${formattedDate}`}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={handlePress}
        style={({ pressed }) => [
          styles.button,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
            opacity: disabled ? 0.6 : pressed ? 0.8 : 1,
          },
        ]}
      >
        <Calendar size={18} color={theme.colors.textSecondary} />
        <Text style={[theme.typography.body, styles.dateText, { color: theme.colors.text }]}>
          {formattedDate}
        </Text>
      </Pressable>

      {showPicker && (
        <DateTimePicker
          testID="date-time-picker"
          value={value}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleDateChange}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    marginBottom: 6,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48, // >= 44pt touch target
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    gap: 10,
  },
  dateText: {
    flex: 1,
  },
});
