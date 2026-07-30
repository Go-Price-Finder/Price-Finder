/**
 * Renders a single schema.org JSON-LD <script> tag. `data` is always
 * generated server-side from real page data (see lib/structured-data.ts)
 * before this ever reaches the client, so there's no user input to
 * escape/sanitize here.
 */
export default function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
