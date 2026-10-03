import { Share } from 'react-native';

import { formatDate } from '@/lib/format';
import { speciesByCode } from '@/lib/taxonomy';
import type { List, Sighting } from '@/types/db';

const WEB = 'https://perch.app'; // placeholder until the web mirror exists; deep link works today

export function shareSighting(s: Sighting) {
  const sp = speciesByCode(s.species_code);
  const where = s.place_name ? ` at ${s.place_name}` : '';
  return Share.share({ message: `${sp?.common ?? s.species_code}${where}, ${formatDate(s.observed_at)}. Logged on Perch.\n${WEB}/sighting/${s.id}`, url: `perch://sighting/${s.id}` }).catch(() => {});
}

export function shareList(l: List) {
  return Share.share({ message: `${l.title}${l.description ? ` — ${l.description}` : ''}\nA list on Perch.\n${WEB}/list/${l.id}`, url: `perch://list/${l.id}` }).catch(() => {});
}
