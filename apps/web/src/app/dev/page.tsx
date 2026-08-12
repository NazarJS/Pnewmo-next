'use client';

import { tsr } from '@/shared/api/tsr';

const DevPage = () => {
  const { data, isPending, error } = tsr.health.check.useQuery({
    queryKey: ['health'],
  });

  return (
    <section>
      <h1>Dev</h1>

      {isPending && <p>Загрузка...</p>}

      {error && <p>API недоступен</p>}

      {data?.status === 200 && (
        <p>
          API: {data.body.status}, uptime {data.body.uptime.toFixed(1)}s
        </p>
      )}
    </section>
  );
};

export default DevPage;