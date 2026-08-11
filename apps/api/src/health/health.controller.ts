import { Controller } from '@nestjs/common';
import { contract } from '@pnewmo/api-contract';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';

@Controller()
export class HealthController {
  @TsRestHandler(contract.health.check)
  check() {
    // ts-rest requires the handler to return a Promise, because real handlers
    // hit a database. This one is synchronous, so the promise is explicit
    // rather than an `async` function with nothing to await.
    return tsRestHandler(contract.health.check, () =>
      Promise.resolve({
        status: 200 as const,
        body: {
          status: 'ok' as const,
          uptime: process.uptime(),
        },
      }),
    );
  }
}
