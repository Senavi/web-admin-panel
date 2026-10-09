import { createCollectionListRoute } from '@/core/collections/list-route';
import { BlogView } from '@/site/pages/blog';

const route = createCollectionListRoute('blog', 'blog', BlogView);

export default route.Page;
export const generateMetadata = route.generateMetadata;
/** The query (`?page=`) decides the status code, so the list renders per request (data is cached). */
export const instant = false;
