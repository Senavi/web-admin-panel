import { createCollectionItemRoute } from '@/core/collections/item-route';
import { BlogPostView } from '@/site/pages/blog-post';

const route = createCollectionItemRoute('blog', BlogPostView);

export default route.Page;
export const generateMetadata = route.generateMetadata;
export const generateStaticParams = route.generateStaticParams;
/** Items render per URL (unknown slugs are a 404, old slugs redirect), so navigation may block. */
export const instant = false;
