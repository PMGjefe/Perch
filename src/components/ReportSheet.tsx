import { Alert } from 'react-native';

import { friendlyError } from '@/lib/errors';
import { haptic } from '@/lib/haptics';
import { type ReportTarget, report } from '@/lib/social';

const REASONS = ['Spam', 'Harassment', 'Not a bird / off topic', 'Reveals a sensitive location', 'Something else'];

/** Two-step native alert: pick a reason, confirm. Keeps moderation one tap away without a custom sheet. */
export function reportContent(userId: string, type: ReportTarget, id: string) {
  Alert.alert('Report this?', 'Tell us what is wrong. Reports are private.', [
    ...REASONS.map((reason) => ({
      text: reason,
      onPress: async () => {
        try {
          await report(userId, type, id, reason);
          haptic.success();
          Alert.alert('Thanks', 'We will take a look.');
        } catch (e) {
          haptic.warning();
          Alert.alert('Could not send report', friendlyError(e, 'Could not send your report.'));
        }
      },
    })),
    { text: 'Cancel', style: 'cancel' as const },
  ]);
}
