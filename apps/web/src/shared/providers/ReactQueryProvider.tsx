'use client';

import { isServer, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ReactNode } from 'react';

import { tsr } from '@/shared/api/tsr';
import { makeQueryClient } from '@/shared/lib/queryClient';

interface ReactQueryProviderProps {
  children: ReactNode;
}

let browserQueryClient: QueryClient | undefined;

function getBrowserQueryClient(): QueryClient {
  if (isServer) {
    return makeQueryClient();
  }

  browserQueryClient ??= makeQueryClient();

  return browserQueryClient;
}

const ReactQueryProvider = ({ children }: ReactQueryProviderProps) => {
  const queryClient = getBrowserQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      {process.env.NODE_ENV === 'development' && <ReactQueryDevtools initialIsOpen={false} />}
      <tsr.ReactQueryProvider>{children}</tsr.ReactQueryProvider>
    </QueryClientProvider>
  );
};

export default ReactQueryProvider;
