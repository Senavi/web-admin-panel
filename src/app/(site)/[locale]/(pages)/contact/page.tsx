import { createPageRoute } from '@/core/content/page-route';
import { ContactView } from '@/site/pages/contact';

const route = createPageRoute('contact', ContactView);

export default route.Page;
export const generateMetadata = route.generateMetadata;
