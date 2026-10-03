import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useMemo } from 'react';
import { type AccessibilityActionEvent, type AccessibilityActionInfo, Keyboard, Pressable, View } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import { useSharedValue } from 'react-native-reanimated';
import { useIsActive, useReorderableDrag } from 'react-native-reorderable-list';

import { Card, IconButton, Input, Row, Text } from '@/components/ui';
import { haptic } from '@/lib/haptics';
import { spacing, useTheme } from '@/lib/theme';

/**
 * How long a row must be held before it lifts. Nothing else has to line up with it: the list's
 * pan gesture activates from the lift itself, not from a timer (see `useReorderablePan`).
 */
export const DRAG_LONG_PRESS_MS = 400;

/** Screen-reader alternative to dragging, exposed on every row as custom actions. */
const MOVE_ACTIONS: AccessibilityActionInfo[] = [
  { name: 'moveUp', label: 'Move up' },
  { name: 'moveDown', label: 'Move down' },
];
const DRAG_HINT = 'Hold and drag to move this item, or use the Move up and Move down actions';

/**
 * Pan gesture and drag events for a ReorderableList whose rows lift from a Pressable long press
 * (`DraggableItemCard`). Pass all three to the list.
 *
 * The pan activates manually, and only once a row has actually lifted: the long press calls
 * `drag()`, the list's `onDragStart` worklet flags it, and the next touch move activates the pan.
 * Unlike `activateAfterLongPress`, there is no race between the JS long-press timer and a native
 * pan timer (which could cancel the press before it fired, or fail the pan when the finger moved
 * before it activated), a stationary hold over the inputs or buttons never activates the pan, so
 * text selection and slow taps keep working, and navigation gestures such as the modal's
 * swipe-to-dismiss are never blocked.
 */
export function useReorderablePan() {
  // True from a row lifting until the pan activates, or the drag ends without the finger moving.
  const awaitingPan = useSharedValue(false);
  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .manualActivation(true)
        .onTouchesMove((_e, state) => {
          'worklet';
          if (awaitingPan.get()) {
            awaitingPan.set(false);
            state.activate();
          }
        }),
    [awaitingPan],
  );
  const onDragStart = useCallback(() => {
    'worklet';
    awaitingPan.set(true);
  }, [awaitingPan]);
  const onDragEnd = useCallback(() => {
    'worklet';
    awaitingPan.set(false);
  }, [awaitingPan]);
  return { panGesture, onDragStart, onDragEnd };
}

interface Props {
  /** Stable identity of the row; passed back to the callbacks so they can be memoized by the parent. */
  itemKey: string;
  index: number;
  title: string;
  subtitle?: string | null;
  note: string;
  onChangeNote: (key: string, text: string) => void;
  onRemove: (key: string) => void;
  /** Moves the row one place up (-1) or down (1). Drives the screen-reader move actions. */
  onMove: (key: string, direction: -1 | 1) => void;
}

/**
 * One editable row of the list editor. Must be rendered as an item of a ReorderableList
 * (it uses the cell hooks). Hold the row or its handle to drag it; tap the x to remove it.
 */
export const DraggableItemCard = React.memo(function DraggableItemCard({ itemKey, index, title, subtitle, note, onChangeNote, onRemove, onMove }: Props) {
  const { colors, dark } = useTheme();
  const drag = useReorderableDrag();
  const isActive = useIsActive();

  // Dismiss the keyboard before lifting: dropping the row remounts every cell it passed over, which
  // would otherwise unmount a focused note input mid-edit and drop the keyboard during the animation.
  const lift = () => {
    Keyboard.dismiss();
    haptic.lift();
    drag();
  };
  const onAccessibilityAction = (e: AccessibilityActionEvent) => {
    const { actionName } = e.nativeEvent;
    if (actionName === 'moveUp') onMove(itemKey, -1);
    else if (actionName === 'moveDown') onMove(itemKey, 1);
  };

  return (
    // Spacing lives inside the cell so the list measures rows (and animates their neighbours) with it included.
    <View style={{ paddingBottom: spacing.sm }}>
      <Card
        style={[
          { padding: spacing.sm, gap: spacing.xs, borderWidth: 1, overflow: 'visible' },
          isActive && {
            borderColor: colors.accent,
            shadowColor: '#000',
            shadowOpacity: dark ? 0.5 : 0.18,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 6 },
            elevation: 8,
          },
        ]}
      >
        <Row>
          <Pressable
            // A plain tap dismisses the keyboard, as tapping the card did before it became pressable.
            onPress={() => Keyboard.dismiss()}
            onLongPress={lift}
            delayLongPress={DRAG_LONG_PRESS_MS}
            accessibilityRole="button"
            accessibilityLabel={`${title}, item ${index + 1}`}
            accessibilityHint={DRAG_HINT}
            accessibilityActions={MOVE_ACTIONS}
            onAccessibilityAction={onAccessibilityAction}
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}
          >
            <Text variant="caption" faint style={{ width: 20, textAlign: 'right' }}>
              {index + 1}
            </Text>
            <View style={{ flex: 1 }}>
              <Text variant="subheading" numberOfLines={1}>
                {title}
              </Text>
              {subtitle ? (
                <Text variant="caption" muted>
                  {subtitle}
                </Text>
              ) : null}
            </View>
          </Pressable>
          <IconButton name="close" label={`Remove ${title}`} size={18} color={colors.danger} onPress={() => onRemove(itemKey)} style={{ padding: 4 }} />
          <Pressable
            onLongPress={lift}
            delayLongPress={DRAG_LONG_PRESS_MS}
            // 22 icon + 2 x 4 padding + 2 x 9 slop = 48, Android's minimum touch target.
            hitSlop={9}
            accessibilityRole="button"
            accessibilityLabel="Reorder"
            accessibilityHint={DRAG_HINT}
            accessibilityActions={MOVE_ACTIONS}
            onAccessibilityAction={onAccessibilityAction}
            style={({ pressed }) => ({ padding: 4, opacity: pressed ? 0.6 : 1 })}
          >
            <Ionicons name="reorder-three-outline" size={22} color={isActive ? colors.accent : colors.textFaint} />
          </Pressable>
        </Row>
        <Input value={note} onChangeText={(t) => onChangeNote(itemKey, t)} placeholder="Note (optional)" maxLength={300} style={{ paddingVertical: 8, fontSize: 14 }} />
      </Card>
    </View>
  );
});
