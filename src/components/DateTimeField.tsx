import React, { useState } from 'react';
import { View } from 'react-native';

import { Chip, Input, Row, Text } from '@/components/ui';
import { spacing } from '@/lib/theme';

function pad(n: number) {
  return n.toString().padStart(2, '0');
}
function toDateStr(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function toTimeStr(d: Date) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Date + time entry without a native picker dependency. Accepts YYYY-MM-DD and HH:MM. */
export function DateTimeField({ value, onChange }: { value: Date; onChange: (d: Date) => void }) {
  const [date, setDate] = useState(toDateStr(value));
  const [time, setTime] = useState(toTimeStr(value));
  const [seen, setSeen] = useState(value.getTime());
  // Reset the text fields when the parent changes the value (photo EXIF, chips).
  if (seen !== value.getTime()) {
    setSeen(value.getTime());
    setDate(toDateStr(value));
    setTime(toTimeStr(value));
  }

  const commit = (d = date, t = time) => {
    const m = d.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    const tm = t.match(/^(\d{1,2}):(\d{2})$/);
    if (!m || !tm) return;
    const next = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(tm[1]), Number(tm[2]));
    if (!Number.isNaN(next.getTime()) && next.getTime() !== value.getTime()) onChange(next);
  };

  const shift = (days: number) => {
    const d = new Date(value);
    d.setDate(d.getDate() + days);
    onChange(d);
  };

  return (
    <View style={{ gap: spacing.sm }}>
      <Text variant="label" muted>
        When
      </Text>
      <Row>
        <View style={{ flex: 3 }}>
          <Input value={date} onChangeText={setDate} onBlur={() => commit()} keyboardType="numbers-and-punctuation" placeholder="YYYY-MM-DD" />
        </View>
        <View style={{ flex: 2 }}>
          <Input value={time} onChangeText={setTime} onBlur={() => commit()} keyboardType="numbers-and-punctuation" placeholder="HH:MM" />
        </View>
      </Row>
      <Row>
        <Chip label="Now" onPress={() => onChange(new Date())} />
        <Chip label="Yesterday" onPress={() => shift(-1)} />
        <Chip label="−1 day" onPress={() => shift(-1)} />
        <Chip label="+1 day" onPress={() => shift(1)} />
      </Row>
    </View>
  );
}
