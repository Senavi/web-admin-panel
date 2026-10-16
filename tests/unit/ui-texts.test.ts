import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { uiTexts as catalog } from '@/content/ui-texts';
import {
  applyUiTextEdits,
  defineUiTexts,
  flattenTexts,
  resolveMessages,
  resolveUiText,
  UiTextSource,
  unflattenTexts,
} from '@/core/ui-texts/model';
import { checkUiTexts, findMessageUsages } from '@/core/ui-texts/usage-check';
import { validateUiText } from '@/core/ui-texts/validate';

const small = defineUiTexts({
  messages: {
    en: { blog: { readMore: 'Read more', published: 'Published {date}' }, nav: { about: 'About' } },
    uk: { blog: { readMore: 'Читати далі' } },
  },
  namespaces: {
    blog: { label: 'Blog', texts: { readMore: 'Button', published: 'Date line' } },
    nav: { label: 'Menu', texts: { about: 'Link' } },
  },
});

describe('flatten / unflatten', () => {
  it('round-trips nested messages', () => {
    const tree = { errors: { required: 'Required', tooLong: 'Too long' }, title: 'T' };
    const flat = flattenTexts(tree);
    expect(flat).toEqual({
      'errors.required': 'Required',
      'errors.tooLong': 'Too long',
      title: 'T',
    });
    expect(unflattenTexts(flat)).toEqual(tree);
  });
});

describe('fallback chain', () => {
  const layers = (
    overrides: Record<string, Record<string, string>>,
    locale: string,
    main = 'en',
  ) => ({
    overrides,
    locale,
    mainLocale: main,
  });

  it('uses the language edit first, then its file', () => {
    const edited = resolveUiText(
      small,
      'blog',
      'readMore',
      layers({ uk: { readMore: 'Більше' } }, 'uk'),
    );
    expect(edited).toMatchObject({
      value: 'Більше',
      source: UiTextSource.Edited,
      inherited: 'Читати далі',
    });
    expect(resolveUiText(small, 'blog', 'readMore', layers({}, 'uk'))).toMatchObject({
      value: 'Читати далі',
      source: UiTextSource.File,
    });
  });

  it('starts a language without a file from the main language, including its edits', () => {
    const text = resolveUiText(
      small,
      'blog',
      'readMore',
      layers({ en: { readMore: 'Learn more' } }, 'de'),
    );
    expect(text).toMatchObject({ value: 'Learn more', source: UiTextSource.Main });
    // A language that has its own file is not overridden by the main language's edits.
    expect(
      resolveUiText(small, 'blog', 'readMore', layers({ en: { readMore: 'Learn more' } }, 'uk'))
        .value,
    ).toBe('Читати далі');
  });

  it('falls back to the main language file, then English', () => {
    expect(resolveUiText(small, 'blog', 'published', layers({}, 'uk', 'uk'))).toMatchObject({
      value: 'Published {date}',
      source: UiTextSource.English,
    });
    expect(resolveUiText(small, 'nav', 'about', layers({}, 'de', 'uk')).value).toBe('About');
  });

  it('resolves every namespace for next-intl', () => {
    const messages = resolveMessages(small, { blog: { uk: { readMore: 'X' } } }, 'uk', 'en');
    expect(messages).toEqual({
      blog: { readMore: 'X', published: 'Published {date}' },
      nav: { about: 'About' },
    });
  });
});

describe('edits', () => {
  it('stores only texts that differ from what the language inherits; null resets', () => {
    const inherited = (key: string) => (key === 'readMore' ? 'Read more' : 'x');
    expect(applyUiTextEdits({}, { readMore: 'Learn more' }, inherited)).toEqual({
      readMore: 'Learn more',
    });
    expect(
      applyUiTextEdits({ readMore: 'Learn more' }, { readMore: 'Read more' }, inherited),
    ).toEqual({});
    expect(applyUiTextEdits({ readMore: 'A', other: 'B' }, { readMore: null }, inherited)).toEqual({
      other: 'B',
    });
  });

  it('keeps placeholders and refuses other braces', () => {
    expect(validateUiText('Published {date}', 'Опубліковано {date}')).toBeNull();
    expect(validateUiText('Published {date}', 'Опубліковано')).toMatch(/\{date\}/);
    expect(validateUiText('Read more', 'Read {more}')).toMatch(/Curly/);
    expect(validateUiText('Read more', '  ')).toMatch(/Enter a text/);
    expect(validateUiText('Read more', "It's {")).not.toBeNull();
  });
});

describe('usage check', () => {
  const file = (source: string) => [{ file: 'src/site/x.tsx', source }];

  it('reads keys through single and Promise.all bindings', () => {
    const usages = findMessageUsages(
      file(`
        const t = await getTranslations('blog');
        const [settings, c] = await Promise.all([getSettings(), getTranslations('nav')]);
        t('readMore'); t.rich('published', {}); c('about'); t(item.key);
      `),
    );
    expect(
      usages.filter((usage) => usage.key).map((usage) => `${usage.namespace}.${usage.key}`),
    ).toEqual(['blog.readMore', 'blog.published', 'nav.about']);
  });

  it('reports unknown keys, unknown namespaces and undeclared namespaces', () => {
    const problems = checkUiTexts({
      catalog: small,
      files: file(
        `const t = await getTranslations('blog'); t('nope'); const n = useTranslations('zzz');`,
      ),
      declared: new Set<string>(),
    });
    expect(problems.join('\n')).toContain('"blog.nope" is missing');
    expect(problems.join('\n')).toContain('namespace "zzz"');
    expect(problems.join('\n')).toContain('Interface texts "blog"');
  });

  it('passes for this project', () => {
    const dir = path.join(process.cwd(), 'src', 'site');
    const files = fs
      .readdirSync(dir, { recursive: true, encoding: 'utf8' })
      .filter((name) => /\.tsx?$/.test(name))
      .map((name) => ({ file: name, source: fs.readFileSync(path.join(dir, name), 'utf8') }));
    const usages = findMessageUsages(files);
    expect(usages.some((usage) => usage.namespace === 'blog' && usage.key === 'readMore')).toBe(
      true,
    );
    const problems = checkUiTexts({
      catalog,
      files,
      declared: new Set([
        'common',
        'nav',
        'footer',
        'cookie',
        'notFound',
        'blog',
        'contact',
        'forms',
      ]),
    });
    expect(problems).toEqual([]);
  });
});
