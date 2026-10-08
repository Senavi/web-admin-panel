import { createPageRoute } from '@/core/content/page-route';
import { TeamView } from '@/site/pages/team';

const route = createPageRoute('team', TeamView);

export default route.Page;
export const generateMetadata = route.generateMetadata;
