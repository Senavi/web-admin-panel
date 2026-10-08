import { createPageRoute } from '@/core/content/page-route';
import { HomeView } from '@/site/pages/home';

const route = createPageRoute('home', HomeView);

export default route.Page;
export const generateMetadata = route.generateMetadata;
