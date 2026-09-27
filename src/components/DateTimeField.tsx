import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import React, { useEffect, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';

import { Chip, Row, Text } from '@/components/ui';
import { formatDate, formatTime } from '@/lib/format';
import { radius, spacing, useTheme } from '@/lib/theme';

interface Props {
  value: Date;
  onChange: (d: Date) => void;
}

/** A sighting can't be in the future: cap `d` at the moment of the call. */
function notAfterNow(d: Date): Date {
  const now = new Date();
  return d.getTime() > now.getTime() ? now : d;
}

function addDays(d: Date, days: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}

/** "Now" rounded up to the next whole minute, so the pickers' upper bound moves at most once a minute. */
function ceilingNow(): number {
  return Math.ceil(Date.now() / 60_000) * 60_000;
}

/** State updater for the ceiling: hands back `cur` itself (so React bails out) unless the minute rolled over. */
function refreshedCeiling(cur: Date): Date {
  const next = ceilingNow();
  return cur.getTime() === next ? cur : new Date(next);
}

/** How often the ceiling is refreshed while the form sits idle. */
const CEILING_REFRESH_MS = 30_000;

/** The date/time dialogs only exist on Android; elsewhere (web) the row is a read-out and the chips do the work. */
const HAS_DIALOGS = Platform.OS === 'android';

/**
 * When the sighting happened. iOS gets the native compact date + time picker inline; Android (where the
 * picker can only be a dialog) gets a tappable row that opens the date dialog and then the time dialog.
 */
export function DateTimeField({ value, onChange }: Props) {
  const { colors, dark } = useTheme();

  // Upper bound for the pickers and the "+1 day" chip. Held in state (not `new Date()` in render) so it is
  // stable between renders, rounded to the minute so the native picker's maximumDate isn't rewritten on
  // every wheel tick, and refreshed on a timer and right before the user interacts so a form left open for
  // a while (or across midnight) doesn't lock the user out of the most recent minutes, or of today.
  const [ceiling, setCeiling] = useState(() => new Date(ceilingNow()));
  const refreshCeiling = () => setCeiling(refreshedCeiling);
  useEffect(() => {
    const id = setInterval(() => setCeiling(refreshedCeiling), CEILING_REFRESH_MS);
    return () => clearInterval(id);
  }, []);

  // True when `commit` had to pull the chosen time back to now, so the row can say so instead of silently
  // showing a different time from the one just picked (the Android time dialog can't be bounded).
  const [adjusted, setAdjusted] = useState(false);

  const commit = (d: Date) => {
    const capped = notAfterNow(d);
    setAdjusted(capped !== d);
    refreshCeiling();
    onChange(capped);
  };

  // A future `value` from the parent (e.g. a photo whose camera clock is wrong) can't be shown by the iOS
  // picker and must never be saved: normalise it to now.
  useEffect(() => {
    if (value.getTime() > Date.now()) onChange(new Date());
  }, [value, onChange]);

  // Android: date dialog, then time dialog. Each dialog returns a full timestamp that carries over
  // the unchanged half (the date dialog keeps `value`'s time of day, the time dialog keeps the date).
  const openAndroidPickers = () => {
    DateTimePickerAndroid.open({
      value: notAfterNow(value),
      mode: 'date',
      maximumDate: new Date(),
      onDismiss: () => {}, // cancelled: leave the value untouched
      onValueChange: (_event, dated) => {
        const withDate = notAfterNow(dated);
        commit(withDate);
        DateTimePickerAndroid.open({
          value: withDate,
          mode: 'time',
          // `maximumDate` is date-only on Android (TimePickerDialog can't bound it); `commit` clamps instead.
          onDismiss: () => {}, // cancelled: keep the confirmed date and the existing time
          onValueChange: (_event2, timed) => commit(timed),
        });
      },
    });
  };

  const canAddDay = addDays(value, 1).getTime() <= ceiling.getTime();

  const card = {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  } as const;

  return (
    <View style={{ gap: spacing.sm }}>
      <Text variant="label" muted>
        When
      </Text>

      {Platform.OS === 'ios' ? (
        <Row style={[card, { justifyContent: 'space-between' }]} onTouchStart={refreshCeiling}>
          <Ionicons name="calendar-outline" size={20} color={colors.textMuted} accessibilityElementsHidden importantForAccessibility="no" />
          <DateTimePicker
            value={value}
            mode="datetime"
            display="compact"
            maximumDate={ceiling}
            onValueChange={(_event, d) => commit(d)}
            themeVariant={dark ? 'dark' : 'light'}
            accentColor={colors.accent}
          />
        </Row>
      ) : (
        <Pressable
          onPress={HAS_DIALOGS ? openAndroidPickers : undefined}
          disabled={!HAS_DIALOGS}
          accessibilityRole={HAS_DIALOGS ? 'button' : undefined}
          accessibilityLabel={`When: ${formatDate(value)}, ${formatTime(value)}`}
          accessibilityHint={HAS_DIALOGS ? 'Opens the date picker, then the time picker' : undefined}
          style={({ pressed }) => [card, { flexDirection: 'row', alignItems: 'center', gap: spacing.md, opacity: pressed ? 0.85 : 1 }]}
        >
          <Ionicons name="calendar-outline" size={20} color={colors.accent} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="subheading">{formatDate(value)}</Text>
            <Text variant="caption" muted>
              {formatTime(value)}
              {HAS_DIALOGS ? ' · tap to change' : ''}
            </Text>
          </View>
          {HAS_DIALOGS ? <Ionicons name="chevron-forward" size={18} color={colors.textFaint} /> : null}
        </Pressable>
      )}

      {adjusted ? (
        <Text variant="caption" muted>
          Set to now. Sightings can’t be in the future.
        </Text>
      ) : null}

      <Row style={{ flexWrap: 'wrap' }}>
        <Chip label="Now" onPress={() => commit(new Date())} />
        <Chip label="Yesterday" onPress={() => commit(addDays(new Date(), -1))} />
        <Chip label="−1 day" onPress={() => commit(addDays(value, -1))} />
        <View style={{ opacity: canAddDay ? 1 : 0.4, pointerEvents: canAddDay ? 'auto' : 'none' }}>
          <Chip label="+1 day" onPress={canAddDay ? () => commit(addDays(value, 1)) : undefined} />
        </View>
      </Row>
    </View>
  );
}
