// content-check: ignore (catch-all that renders the localized 404 for unknown URLs)
import { notFound } from 'next/navigation';

export default function UnknownPage(): never {
  notFound();
}
