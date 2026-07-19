import type { Rarity } from '../types';
import { RARITY_COLOR, RARITY_LABEL } from '../lib/rarity';

export function RarityBadge({ rarity }: { rarity: Rarity }) {
  return (
    <span className="rarity-badge" style={{ color: RARITY_COLOR[rarity] }}>
      {RARITY_LABEL[rarity]}
    </span>
  );
}
