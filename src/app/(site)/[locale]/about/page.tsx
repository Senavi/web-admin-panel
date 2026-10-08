import { createPageRoute } from '@/core/content/page-route';
import { AboutView } from '@/site/pages/about';

const route = createPageRoute('about', AboutView);

export default route.Page;
export const generateMetadata = route.generateMetadata;
