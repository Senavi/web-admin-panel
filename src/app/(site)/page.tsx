import { projectConfig } from '@project/config';

export default function HomePage() {
  return (
    <main>
      <h1>{projectConfig.name}</h1>
    </main>
  );
}
