/** Centred modal panel of the configurator (native <dialog>: focus trap, Esc and backdrop click close it). */
import type { ComponentChildren } from 'preact';
import { useEffect, useId, useRef } from 'preact/hooks';
import type { Locale } from './i18n';
import { STRINGS } from './i18n';

export function Modal(props: {
  title: string;
  onClose: () => void;
  wide?: boolean;
  children: ComponentChildren;
  locale: Locale;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const t = STRINGS[props.locale];
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (!d.open) d.showModal();
    const onClose = () => props.onClose();
    d.addEventListener('close', onClose);
    return () => d.removeEventListener('close', onClose);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <dialog
      ref={ref}
      class={`q-dialog${props.wide ? ' q-dialog--wide' : ''}`}
      aria-labelledby={titleId}
      onClick={(e) => {
        // A click on the backdrop lands on the <dialog> element itself.
        if (e.target === ref.current) ref.current?.close();
      }}
    >
      <div class="q-dialog__inner">
        <header class="q-dialog__head">
          <h2 id={titleId}>{props.title}</h2>
          <button type="button" class="q-icon-btn" aria-label={t.close} onClick={() => ref.current?.close()}>
            ×
          </button>
        </header>
        <div class="q-dialog__body">{props.children}</div>
      </div>
    </dialog>
  );
}
