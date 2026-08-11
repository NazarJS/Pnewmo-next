/**
 * Доменные коды ошибок. PERMISSION_DENIED появится вместе с авторизацией —
 * код без применения только вводит в заблуждение.
 */
export enum AppError {
  NOT_FOUND = 'NOT_FOUND',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  CONFLICT = 'CONFLICT',
  INTERNAL = 'INTERNAL',
}
