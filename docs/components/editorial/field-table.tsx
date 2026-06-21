"use client";

/* Accordion field reference — the warm-paper take on Fumadocs' TypeTable. A bordered
 * panel with a header row (Field · Type) and dense, divided rows; clicking a row expands
 * its description into an inset panel. Replaces a plain `| Field | Type | Description |`
 * markdown table.
 *
 * Why children, not a `type={{}}` object prop: descriptions are authored as MDX, so
 * <Term>, inline `code`, and *italics* render. A data prop would force authors to inline
 * JSX and lose that. The accordion mechanism is the in-house one from `api/faq.tsx`
 * (button + CSS-grid rows reveal) so the description stays in the DOM when collapsed (good
 * for Cmd-F and the search index). The description container is a <div> with `[&>p]:m-0`:
 * MDX wraps the text child in a <p>, so a <p> here would nest <p><p> → hydration error.
 * Colors come from the editorial @theme tokens (text-ed-ink, bg-ed-paper, …). */

import {
  Children,
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
  useId,
  useState,
} from "react";

type FieldProps = {
  name: string;
  type?: string;
  required?: boolean;
  defaultOpen?: boolean;
  children?: ReactNode;
};

export function FieldTable({
  children,
  defaultOpen = false,
}: {
  children?: ReactNode;
  defaultOpen?: boolean;
}) {
  const rows = Children.toArray(children).filter((c): c is ReactElement<FieldProps> =>
    isValidElement(c),
  );
  return (
    <div className="my-[24px] overflow-hidden rounded-[12px] border border-ed-hairline bg-ed-paper">
      <div className="flex items-center gap-[12px] border-b border-ed-hairline bg-ed-header px-[16px] py-[9px] font-[family-name:var(--font-mono)] text-[10.5px] font-[600] uppercase tracking-[0.07em] text-ed-ink-45">
        <span>Field</span>
        <span className="ml-auto">Type</span>
        <span className="w-[14px]" />
      </div>
      <div className="divide-y divide-ed-hairline">
        {rows.map((row, i) =>
          cloneElement(row, {
            key: row.key ?? i,
            defaultOpen: row.props.defaultOpen ?? defaultOpen,
          }),
        )}
      </div>
    </div>
  );
}

export function Field({ name, type, required, defaultOpen = false, children }: FieldProps) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = `field-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const hasBody = children != null && children !== false;

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={hasBody ? panelId : undefined}
        onClick={() => hasBody && setOpen((o) => !o)}
        className={`flex w-full items-center gap-[12px] px-[16px] py-[11px] text-left hover:bg-ed-row-hover ${
          hasBody ? "cursor-pointer" : "cursor-default"
        }`}
      >
        <span className="text-[14px] font-[550] tracking-[0.1px] text-ed-ink">{name}</span>
        {required && (
          <span className="inline-flex items-center rounded-[5px] border border-ed-amber-stroke bg-ed-amber-fill px-[6px] py-[1px] text-[10px] font-medium tracking-[0.02em] text-ed-amber-text">
            required
          </span>
        )}
        <span className="ml-auto font-[family-name:var(--font-mono)] text-[12.5px] text-ed-ink-45 whitespace-nowrap">
          {type}
        </span>
        {hasBody ? (
          <span
            aria-hidden="true"
            className={`w-[14px] text-center text-[18px] leading-none text-ed-brand-ink transition-transform duration-200 motion-reduce:transition-none ${
              open ? "rotate-45" : ""
            }`}
          >
            +
          </span>
        ) : (
          <span className="w-[14px]" />
        )}
      </button>
      {hasBody && (
        <div
          className={`grid overflow-hidden transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none ${
            open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
          }`}
        >
          <div className="min-h-0 overflow-hidden">
            <div
              id={panelId}
              role="region"
              className="border-t border-ed-hairline bg-ed-inset px-[16px] py-[12px] text-[13.5px] leading-[160%] text-ed-ink-66 [&>p]:m-0 [&>p]:text-[13.5px] [&>p]:leading-[160%] [&>p]:text-ed-ink-66 [&>p+p]:mt-[8px]"
            >
              {children}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
