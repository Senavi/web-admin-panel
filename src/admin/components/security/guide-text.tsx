import { Fragment } from 'react';

/** Text with `**bold**` parts (hosting-guides.ts). */
export function GuideText({ text }: { text: string }) {
  return (
    <>
      {text
        .split('**')
        .map((part, index) =>
          index % 2 === 1 ? (
            <strong key={index}>{part}</strong>
          ) : (
            <Fragment key={index}>{part}</Fragment>
          ),
        )}
    </>
  );
}

/** Numbered guide steps. */
export function GuideSteps({ items }: { items: readonly string[] }) {
  return (
    <ol className="flex list-decimal flex-col gap-2 ps-5 text-sm">
      {items.map((item) => (
        <li key={item}>
          <GuideText text={item} />
        </li>
      ))}
    </ol>
  );
}
