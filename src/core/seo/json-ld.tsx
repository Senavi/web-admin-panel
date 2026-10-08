/**
 * JSON-LD helpers (schema.org). Rendered as `application/ld+json` scripts,
 * which browsers never execute; `<` is escaped so content can't close the tag.
 */
export type JsonLdObject = { readonly '@type': string } & Readonly<Record<string, unknown>>;

export function JsonLd({ data }: { data: JsonLdObject | readonly JsonLdObject[] }) {
  const graph = Array.isArray(data)
    ? { '@context': 'https://schema.org', '@graph': data }
    : { '@context': 'https://schema.org', ...data };
  return (
    <script
      type="application/ld+json"
      // JSON (not executable), with `<` escaped so content cannot close the tag.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph).replace(/</g, '\\u003c') }}
    />
  );
}

export function organizationJsonLd(input: {
  name: string;
  url: string;
  logo?: string;
  sameAs?: readonly string[];
}): JsonLdObject {
  return {
    '@type': 'Organization',
    name: input.name,
    url: input.url,
    ...(input.logo ? { logo: input.logo } : {}),
    ...(input.sameAs?.length ? { sameAs: input.sameAs } : {}),
  };
}

export function websiteJsonLd(input: {
  name: string;
  url: string;
  inLanguage: string;
}): JsonLdObject {
  return { '@type': 'WebSite', name: input.name, url: input.url, inLanguage: input.inLanguage };
}

export function breadcrumbJsonLd(
  items: ReadonlyArray<{ name: string; url: string }>,
): JsonLdObject {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}
