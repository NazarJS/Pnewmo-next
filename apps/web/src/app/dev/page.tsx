import { api } from '@/shared/api/client';

export const dynamic = 'force-dynamic';

const DevPage = async () => {
  const response = await api.health.check();

  return (
    <section>
      <h1>Dev</h1>

      {response.status === 200 ? (
        <p>
          API: {response.body.status}, uptime {response.body.uptime.toFixed(1)}s
        </p>
      ) : (
        <p>API недоступен, статус {response.status}</p>
      )}
    </section>
  );
};

export default DevPage;
