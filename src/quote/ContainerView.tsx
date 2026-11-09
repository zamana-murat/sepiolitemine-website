/**
 * 3D loading view of one container (orthographic, door at the bottom). Geometry comes from
 * buildScene() — the same picture the offer PDF prints — and positions from planLoad(), so the
 * drawing never contradicts the numbers.
 */
import { useMemo } from 'preact/hooks';
import type { LoadItem } from '../lib/quote/loading';
import { buildScene } from '../lib/quote/scene3d';
import type { CatalogContainer } from '../lib/quote/types';
import type { Locale } from './i18n';
import { STRINGS } from './i18n';

export function ContainerView(props: {
  container: CatalogContainer;
  items: LoadItem[];
  colorOf: (productId: number) => string;
  index: number;
  locale: Locale;
}) {
  const t = STRINGS[props.locale];
  const scene = useMemo(
    () => buildScene(props.container, props.items, props.colorOf),
    [props.container, props.items, props.colorOf],
  );
  return (
    <svg
      class="q-drawing"
      viewBox={`0 0 ${Math.round(scene.width)} ${Math.round(scene.height)}`}
      role="img"
      aria-label={t.drawingLabel(props.index + 1, props.container.code)}
    >
      {scene.paths.map((p, i) => (
        <path
          key={i}
          d={p.d}
          fill={p.fill ?? 'none'}
          fill-opacity={p.fillOpacity}
          stroke={p.stroke}
          stroke-width={p.strokeWidth}
          stroke-opacity={p.strokeOpacity}
          stroke-linejoin="round"
          stroke-linecap="round"
        />
      ))}
      <text
        x={scene.door.x}
        y={scene.door.y}
        text-anchor="middle"
        dominant-baseline="hanging"
        font-size={Math.round(scene.width * 0.075)}
        class="q-drawing__label"
      >
        {t.door}
      </text>
    </svg>
  );
}
