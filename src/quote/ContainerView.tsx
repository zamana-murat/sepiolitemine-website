/**
 * Top view of a container's loading plan (SVG, mm units). Positions come from planLoad(),
 * the same model as the capacity check, so the drawing never contradicts the numbers.
 * The door is on the right; stacks fill from the front wall (left).
 */
import { planLoad, type LoadItem } from '../lib/quote/loading';
import type { CatalogContainer } from '../lib/quote/types';
import type { Locale } from './i18n';
import { STRINGS } from './i18n';
import { textOn } from './colors';

const INSET = 18;

export function ContainerView(props: {
  container: CatalogContainer;
  items: LoadItem[];
  colorOf: (productId: number) => string;
  index: number;
  locale: Locale;
}) {
  const c = props.container;
  const t = STRINGS[props.locale];
  const plan = planLoad(c, props.items);
  const L = c.innerLengthMm;
  const W = c.innerWidthMm;
  const drawnLength = Math.max(L, plan.usedLengthMm);
  const font = Math.round(W * 0.11);

  return (
    <svg
      class="q-drawing"
      viewBox={`-60 -60 ${drawnLength + 620} ${W + 120}`}
      role="img"
      aria-label={t.drawingLabel(props.index + 1, c.code)}
    >
      {/* overflow zone beyond the container */}
      {plan.usedLengthMm > L && (
        <rect x={L} y={0} width={plan.usedLengthMm - L} height={W} class="q-drawing__overflow" />
      )}
      <rect x={0} y={0} width={L} height={W} class="q-drawing__floor" />

      {plan.placements.map((s, i) => {
        let cursor = s.x;
        const total = s.height;
        return (
          <g key={i} class={s.overflow ? 'q-drawing__stack q-drawing__stack--over' : 'q-drawing__stack'}>
            {s.units.map((u, j) => {
              const w = (s.depth * u.count) / total;
              const x = cursor;
              cursor += w;
              return (
                <rect
                  key={j}
                  x={x + (j === 0 ? INSET : 0)}
                  y={s.y + INSET}
                  width={Math.max(0, w - (j === 0 ? INSET : 0) - (j === s.units.length - 1 ? INSET : 0))}
                  height={s.across - 2 * INSET}
                  rx={s.packagingType === 'bigbag' ? 90 : 20}
                  fill={props.colorOf(u.productId)}
                />
              );
            })}
            {s.height > 1 && (
              <text
                x={s.x + s.depth / 2}
                y={s.y + s.across / 2}
                font-size={font}
                text-anchor="middle"
                dominant-baseline="central"
                fill={textOn(props.colorOf(s.units[0]?.productId ?? 0))}
              >
                ×{s.height}
              </text>
            )}
          </g>
        );
      })}

      {/* door */}
      <line x1={L} y1={-30} x2={L} y2={W + 30} class="q-drawing__door" />
      <text
        x={drawnLength + 300}
        y={W / 2}
        font-size={font}
        text-anchor="middle"
        dominant-baseline="central"
        transform={`rotate(-90 ${drawnLength + 300} ${W / 2})`}
        class="q-drawing__label"
      >
        {t.door}
      </text>
    </svg>
  );
}
