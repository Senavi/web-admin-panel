/**
 * Master list of languages an admin can add in Settings → General → Languages
 * (pure data, safe for client code). The stored settings decide which of these
 * a site uses; `project.config.ts` only provides the initial set.
 */

/** Writing systems (ISO 15924). `Latx` is Latin that needs the "latin-ext" font subset. */
export const Script = {
  Latin: 'Latn',
  LatinExtended: 'Latx',
  Cyrillic: 'Cyrl',
  Greek: 'Grek',
  Arabic: 'Arab',
  Hebrew: 'Hebr',
  Devanagari: 'Deva',
  Bengali: 'Beng',
  Thai: 'Thai',
  Han: 'Hans',
  HanTraditional: 'Hant',
  Japanese: 'Jpan',
  Korean: 'Kore',
  Armenian: 'Armn',
  Georgian: 'Geor',
  Tamil: 'Taml',
  Telugu: 'Telu',
  Kannada: 'Knda',
  Malayalam: 'Mlym',
  Gujarati: 'Gujr',
  Gurmukhi: 'Guru',
  Sinhala: 'Sinh',
  Khmer: 'Khmr',
  Lao: 'Laoo',
  Myanmar: 'Mymr',
  Ethiopic: 'Ethi',
  Mongolian: 'Mong',
} as const;
export type ScriptCode = (typeof Script)[keyof typeof Script];

export type TextDirection = 'ltr' | 'rtl';

export interface Language {
  /** BCP 47 code used in URLs and `<html lang>`. */
  readonly code: string;
  readonly name: string;
  /** Name in the language itself (shown in the site's language switcher). */
  readonly native: string;
  readonly dir: TextDirection;
  readonly script: ScriptCode;
}

type Row = readonly [code: string, name: string, native: string, script?: ScriptCode, rtl?: 'rtl'];

const L = Script.Latin;
const X = Script.LatinExtended;
const C = Script.Cyrillic;
const A = Script.Arabic;

const ROWS: readonly Row[] = [
  ['en', 'English', 'English'],
  ['uk', 'Ukrainian', 'Українська', C],
  ['ru', 'Russian', 'Русский', C],
  ['pl', 'Polish', 'Polski', X],
  ['de', 'German', 'Deutsch'],
  ['fr', 'French', 'Français'],
  ['es', 'Spanish', 'Español'],
  ['it', 'Italian', 'Italiano'],
  ['pt', 'Portuguese', 'Português'],
  ['pt-BR', 'Portuguese (Brazil)', 'Português (Brasil)'],
  ['nl', 'Dutch', 'Nederlands'],
  ['sv', 'Swedish', 'Svenska'],
  ['da', 'Danish', 'Dansk'],
  ['nb', 'Norwegian (Bokmål)', 'Norsk bokmål'],
  ['fi', 'Finnish', 'Suomi'],
  ['is', 'Icelandic', 'Íslenska', X],
  ['cs', 'Czech', 'Čeština', X],
  ['sk', 'Slovak', 'Slovenčina', X],
  ['hu', 'Hungarian', 'Magyar', X],
  ['ro', 'Romanian', 'Română', X],
  ['bg', 'Bulgarian', 'Български', C],
  ['sr', 'Serbian', 'Српски', C],
  ['sr-Latn', 'Serbian (Latin)', 'Srpski', X],
  ['hr', 'Croatian', 'Hrvatski', X],
  ['bs', 'Bosnian', 'Bosanski', X],
  ['sl', 'Slovenian', 'Slovenščina', X],
  ['mk', 'Macedonian', 'Македонски', C],
  ['sq', 'Albanian', 'Shqip', X],
  ['el', 'Greek', 'Ελληνικά', Script.Greek],
  ['tr', 'Turkish', 'Türkçe', X],
  ['lt', 'Lithuanian', 'Lietuvių', X],
  ['lv', 'Latvian', 'Latviešu', X],
  ['et', 'Estonian', 'Eesti', X],
  ['be', 'Belarusian', 'Беларуская', C],
  ['ka', 'Georgian', 'ქართული', Script.Georgian],
  ['hy', 'Armenian', 'Հայերեն', Script.Armenian],
  ['az', 'Azerbaijani', 'Azərbaycanca', X],
  ['kk', 'Kazakh', 'Қазақша', C],
  ['uz', 'Uzbek', 'Oʻzbekcha', X],
  ['ky', 'Kyrgyz', 'Кыргызча', C],
  ['tg', 'Tajik', 'Тоҷикӣ', C],
  ['tk', 'Turkmen', 'Türkmençe', X],
  ['mn', 'Mongolian', 'Монгол', C],
  ['ga', 'Irish', 'Gaeilge', X],
  ['cy', 'Welsh', 'Cymraeg', X],
  ['mt', 'Maltese', 'Malti', X],
  ['ca', 'Catalan', 'Català'],
  ['eu', 'Basque', 'Euskara'],
  ['gl', 'Galician', 'Galego'],
  ['lb', 'Luxembourgish', 'Lëtzebuergesch'],
  ['af', 'Afrikaans', 'Afrikaans'],
  ['sw', 'Swahili', 'Kiswahili'],
  ['zu', 'Zulu', 'isiZulu'],
  ['xh', 'Xhosa', 'isiXhosa'],
  ['yo', 'Yoruba', 'Yorùbá', X],
  ['ig', 'Igbo', 'Igbo', X],
  ['ha', 'Hausa', 'Hausa', X],
  ['so', 'Somali', 'Soomaali'],
  ['am', 'Amharic', 'አማርኛ', Script.Ethiopic],
  ['mg', 'Malagasy', 'Malagasy'],
  ['ar', 'Arabic', 'العربية', A, 'rtl'],
  ['he', 'Hebrew', 'עברית', Script.Hebrew, 'rtl'],
  ['fa', 'Persian', 'فارسی', A, 'rtl'],
  ['ur', 'Urdu', 'اردو', A, 'rtl'],
  ['ps', 'Pashto', 'پښتو', A, 'rtl'],
  ['ku', 'Kurdish', 'Kurdî', X],
  ['ckb', 'Kurdish (Sorani)', 'کوردیی ناوەندی', A, 'rtl'],
  ['sd', 'Sindhi', 'سنڌي', A, 'rtl'],
  ['hi', 'Hindi', 'हिन्दी', Script.Devanagari],
  ['mr', 'Marathi', 'मराठी', Script.Devanagari],
  ['ne', 'Nepali', 'नेपाली', Script.Devanagari],
  ['bn', 'Bengali', 'বাংলা', Script.Bengali],
  ['pa', 'Punjabi', 'ਪੰਜਾਬੀ', Script.Gurmukhi],
  ['gu', 'Gujarati', 'ગુજરાતી', Script.Gujarati],
  ['ta', 'Tamil', 'தமிழ்', Script.Tamil],
  ['te', 'Telugu', 'తెలుగు', Script.Telugu],
  ['kn', 'Kannada', 'ಕನ್ನಡ', Script.Kannada],
  ['ml', 'Malayalam', 'മലയാളം', Script.Malayalam],
  ['si', 'Sinhala', 'සිංහල', Script.Sinhala],
  ['th', 'Thai', 'ไทย', Script.Thai],
  ['lo', 'Lao', 'ລາວ', Script.Lao],
  ['km', 'Khmer', 'ខ្មែរ', Script.Khmer],
  ['my', 'Burmese', 'မြန်မာ', Script.Myanmar],
  ['vi', 'Vietnamese', 'Tiếng Việt', X],
  ['id', 'Indonesian', 'Bahasa Indonesia'],
  ['ms', 'Malay', 'Bahasa Melayu'],
  ['fil', 'Filipino', 'Filipino'],
  ['jv', 'Javanese', 'Basa Jawa'],
  ['zh', 'Chinese (Simplified)', '简体中文', Script.Han],
  ['zh-TW', 'Chinese (Traditional)', '繁體中文', Script.HanTraditional],
  ['ja', 'Japanese', '日本語', Script.Japanese],
  ['ko', 'Korean', '한국어', Script.Korean],
  ['eo', 'Esperanto', 'Esperanto', X],
  ['la', 'Latin', 'Latina'],
  ['ht', 'Haitian Creole', 'Kreyòl ayisyen'],
  ['mi', 'Maori', 'Te Reo Māori', X],
  ['haw', 'Hawaiian', 'ʻŌlelo Hawaiʻi', X],
  ['sm', 'Samoan', 'Gagana Samoa'],
  ['qu', 'Quechua', 'Runasimi'],
  ['gd', 'Scottish Gaelic', 'Gàidhlig'],
  ['br', 'Breton', 'Brezhoneg'],
  ['fy', 'Western Frisian', 'Frysk'],
  ['rw', 'Kinyarwanda', 'Kinyarwanda'],
  ['sn', 'Shona', 'chiShona'],
  ['ny', 'Chichewa', 'Chichewa'],
];

export const LANGUAGES: readonly Language[] = ROWS.map(([code, name, native, script, rtl]) => ({
  code,
  name,
  native,
  dir: rtl ?? 'ltr',
  script: script ?? L,
}));

const byCode = new Map(LANGUAGES.map((language) => [language.code, language]));

export function findLanguage(code: string): Language | undefined {
  return byCode.get(code);
}

export function isKnownLanguage(code: string): boolean {
  return byCode.has(code);
}

/** Scripts the site fonts cover when the project config does not say otherwise. */
export const DEFAULT_FONT_SCRIPTS: readonly ScriptCode[] = [Script.Latin, Script.Cyrillic];

export type LanguageWarning = 'rtl' | 'font';

/**
 * Why a language needs a developer's attention: right-to-left layout, or a
 * writing system the site fonts do not cover.
 */
export function languageWarnings(
  code: string,
  fontScripts: readonly ScriptCode[] = DEFAULT_FONT_SCRIPTS,
): LanguageWarning[] {
  const language = findLanguage(code);
  if (!language) return [];
  const warnings: LanguageWarning[] = [];
  if (language.dir === 'rtl') warnings.push('rtl');
  if (!fontScripts.includes(language.script)) warnings.push('font');
  return warnings;
}

export const LANGUAGE_WARNING_TEXT =
  'Check with your developer: fonts/layout may need changes for this language.';
