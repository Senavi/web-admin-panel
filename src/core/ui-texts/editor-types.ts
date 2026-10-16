import type { UiTextSource } from './model';

/** Serializable data of the "Interface texts" editor (server → client). */

export interface UiTextRow {
  /** Key inside the namespace (`readMore`, `errors.required`). */
  readonly key: string;
  /** Human description: "Button on blog cards". */
  readonly label: string;
  /** Current text in this language (what visitors see). */
  readonly value: string;
  readonly source: UiTextSource;
  /** What "Reset" returns to. */
  readonly inherited: string;
}

export interface UiTextUserLink {
  readonly id: string;
  readonly label: string;
  readonly href: string;
}

export interface UiTextGroup {
  readonly namespace: string;
  readonly label: string;
  /** Version of the saved row for this language (0 = nothing saved yet). */
  readonly version: number;
  /** Other places that show these texts ("Also on: …"). */
  readonly alsoOn: readonly UiTextUserLink[];
  readonly texts: readonly UiTextRow[];
}
