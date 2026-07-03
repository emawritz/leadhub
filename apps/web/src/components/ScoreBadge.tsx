import { scoreTier } from '@leadhub/core/score';
import { stageColor } from '@leadhub/core/stages';

const TIER_COLOR: Record<string, string> = {
  alto: stageColor('ganado'),      // verde apagado
  medio: stageColor('negociacion'),// ámbar apagado
  bajo: '#8e8e93',                 // gris
};

export default function ScoreBadge({ score, title }: { score: number; title?: string }) {
  const tier = scoreTier(score);
  const color = TIER_COLOR[tier];
  return (
    <span
      title={title}
      className="inline-flex items-center justify-center min-w-[2.25rem] px-1.5 py-0.5 rounded-pill text-[12px] font-semibold"
      style={{ color, backgroundColor: `${color}1f` }}
    >
      {score}
    </span>
  );
}
