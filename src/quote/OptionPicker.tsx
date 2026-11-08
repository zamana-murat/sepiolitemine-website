import type { CatalogOption } from '../lib/quote/types';
import type { Formatters, Locale } from './i18n';
import { STRINGS, groupLabel, optionPriceLabel } from './i18n';
import { toggleOption } from './state';

export function OptionPicker(props: {
  name: string;
  options: CatalogOption[];
  selected: number[];
  onChange: (ids: number[]) => void;
  fmt: Formatters;
  locale: Locale;
}) {
  const { options, selected, fmt, locale } = props;
  if (options.length === 0) return null;
  const t = STRINGS[locale];
  const label = (o: CatalogOption) => (locale === 'tr' ? o.nameTr : o.nameEn);
  const desc = (o: CatalogOption) => (locale === 'tr' ? o.descriptionTr : o.descriptionEn);

  const groups = new Map<string, CatalogOption[]>();
  const singles: CatalogOption[] = [];
  for (const o of options) {
    if (o.groupName) groups.set(o.groupName, [...(groups.get(o.groupName) ?? []), o]);
    else singles.push(o);
  }

  const optionText = (o: CatalogOption) => (
    <>
      <span class="q-opt__name">{label(o)}</span>
      <span class="q-opt__price">
        {optionPriceLabel(o, fmt, locale)}
        {o.isMandatory && ` · ${t.included}`}
      </span>
      {desc(o) && <span class="q-opt__desc">{desc(o)}</span>}
    </>
  );

  return (
    <div class="q-opts">
      {singles.map((o) => (
        <label key={o.id} class={`q-opt${o.isMandatory ? ' q-opt--locked' : ''}`}>
          <input
            type="checkbox"
            checked={o.isMandatory || selected.includes(o.id)}
            disabled={o.isMandatory}
            onChange={(e) => props.onChange(toggleOption(selected, options, o.id, e.currentTarget.checked))}
          />
          {optionText(o)}
        </label>
      ))}
      {[...groups].map(([group, opts]) => {
        const locked = opts.find((o) => o.isMandatory);
        const current = locked?.id ?? opts.find((o) => selected.includes(o.id))?.id ?? null;
        const radioName = `${props.name}-${group}`;
        return (
          <fieldset key={group} class="q-optgroup">
            <legend>{groupLabel(group, locale)}</legend>
            {!locked && (
              <label class="q-opt">
                <input
                  type="radio"
                  name={radioName}
                  checked={current === null}
                  onChange={() => props.onChange(selected.filter((id) => !opts.some((o) => o.id === id)))}
                />
                <span class="q-opt__name">{t.none}</span>
              </label>
            )}
            {opts.map((o) => (
              <label key={o.id} class={`q-opt${locked ? ' q-opt--locked' : ''}`}>
                <input
                  type="radio"
                  name={radioName}
                  checked={current === o.id}
                  disabled={Boolean(locked)}
                  onChange={() => props.onChange(toggleOption(selected, options, o.id, true))}
                />
                {optionText(o)}
              </label>
            ))}
          </fieldset>
        );
      })}
    </div>
  );
}
