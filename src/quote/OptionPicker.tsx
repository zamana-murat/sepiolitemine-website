/**
 * Option list (product options, container services, order services).
 * An option with a description shows its name with a dashed underline: hover / focus shows the
 * short description in a tooltip, a click opens the long description in a centred panel.
 * The checkbox / radio stays the control that selects the option.
 */
import { Fragment } from 'preact';
import { useId, useState } from 'preact/hooks';
import type { CatalogOption } from '../lib/quote/types';
import type { Formatters, Locale } from './i18n';
import { STRINGS, groupLabel, optionPriceLabel } from './i18n';
import { Modal } from './Modal';
import { toggleOption } from './state';

const text = (o: CatalogOption, locale: Locale) => ({
  name: locale === 'tr' ? o.nameTr : o.nameEn,
  short: (locale === 'tr' ? o.descriptionTr : o.descriptionEn)?.trim() ?? '',
  long: (locale === 'tr' ? o.longDescriptionTr : o.longDescriptionEn)?.trim() ?? '',
});

/** Plain text → paragraphs (blank line), single newlines kept as line breaks. */
export function Paragraphs(props: { text: string; class?: string }) {
  return (
    <>
      {props.text
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p, i) => (
          <p key={i} class={props.class}>
            {p.split('\n').map((line, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                {line}
              </Fragment>
            ))}
          </p>
        ))}
    </>
  );
}

export function OptionInfoPanel(props: { option: CatalogOption; onClose: () => void; fmt: Formatters; locale: Locale }) {
  const { option: o, fmt, locale } = props;
  const t = STRINGS[locale];
  const x = text(o, locale);
  return (
    <Modal title={x.name} onClose={props.onClose} locale={locale}>
      <p class="q-optinfo__price">
        {optionPriceLabel(o, fmt, locale)}
        {o.isMandatory && ` · ${t.included}`}
        {o.groupName && <span class="q-optinfo__group"> · {groupLabel(o.groupName, locale)}</span>}
      </p>
      {x.short && <p class="q-optinfo__lead">{x.short}</p>}
      {x.long ? <Paragraphs text={x.long} class="q-optinfo__text" /> : !x.short && <p class="q-hint">{t.noDescription}</p>}
    </Modal>
  );
}

/** Option name: plain label text, or (with a description) a dashed-underlined button with tooltip. */
function OptionName(props: { option: CatalogOption; inputId: string; onOpen: () => void; locale: Locale }) {
  const tipId = useId();
  const t = STRINGS[props.locale];
  const x = text(props.option, props.locale);
  if (!x.short && !x.long) {
    return (
      <label class="q-opt__name" for={props.inputId}>
        {x.name}
      </label>
    );
  }
  return (
    <span class="q-opt__info">
      <button
        type="button"
        class="q-opt__name q-opt__name--info"
        aria-haspopup="dialog"
        aria-describedby={tipId}
        onClick={props.onOpen}
      >
        {x.name}
      </button>
      <span class="q-tip" role="tooltip" id={tipId}>
        {x.short || t.moreInfo}
        {x.short && x.long && <span class="q-tip__more">{t.clickForMore}</span>}
      </span>
    </span>
  );
}

export function OptionPicker(props: {
  name: string;
  options: CatalogOption[];
  selected: number[];
  onChange: (ids: number[]) => void;
  fmt: Formatters;
  locale: Locale;
}) {
  const { options, selected, fmt, locale } = props;
  const [info, setInfo] = useState<CatalogOption | null>(null);
  const baseId = useId();
  if (options.length === 0) return null;
  const t = STRINGS[locale];
  const inputId = (o: CatalogOption) => `${baseId}-o${o.id}`;

  const groups = new Map<string, CatalogOption[]>();
  const singles: CatalogOption[] = [];
  for (const o of options) {
    if (o.groupName) groups.set(o.groupName, [...(groups.get(o.groupName) ?? []), o]);
    else singles.push(o);
  }

  const optionText = (o: CatalogOption) => (
    <>
      <OptionName option={o} inputId={inputId(o)} onOpen={() => setInfo(o)} locale={locale} />
      <span class="q-opt__price">
        {optionPriceLabel(o, fmt, locale)}
        {o.isMandatory && ` · ${t.included}`}
      </span>
    </>
  );

  return (
    <div class="q-opts">
      {singles.map((o) => (
        <div key={o.id} class={`q-opt${o.isMandatory ? ' q-opt--locked' : ''}`}>
          <input
            id={inputId(o)}
            type="checkbox"
            aria-label={text(o, locale).name}
            checked={o.isMandatory || selected.includes(o.id)}
            disabled={o.isMandatory}
            onChange={(e) => props.onChange(toggleOption(selected, options, o.id, e.currentTarget.checked))}
          />
          {optionText(o)}
        </div>
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
              <div key={o.id} class={`q-opt${locked ? ' q-opt--locked' : ''}`}>
                <input
                  id={inputId(o)}
                  type="radio"
                  name={radioName}
                  aria-label={text(o, locale).name}
                  checked={current === o.id}
                  disabled={Boolean(locked)}
                  onChange={() => props.onChange(toggleOption(selected, options, o.id, true))}
                />
                {optionText(o)}
              </div>
            ))}
          </fieldset>
        );
      })}
      {info && <OptionInfoPanel option={info} onClose={() => setInfo(null)} fmt={fmt} locale={locale} />}
    </div>
  );
}
