import { AppError } from './app-error.enum';
import {
  appErrorByPrismaCode,
  appErrorByStatus,
  extractTsRestIssues,
  statusByAppError,
} from './error-mapping';

describe('statusByAppError', () => {
  it('maps every AppError to a status', () => {
    expect(statusByAppError[AppError.NOT_FOUND]).toBe(404);
    expect(statusByAppError[AppError.VALIDATION_FAILED]).toBe(400);
    expect(statusByAppError[AppError.CONFLICT]).toBe(409);
    expect(statusByAppError[AppError.INTERNAL]).toBe(500);
  });
});

describe('appErrorByPrismaCode', () => {
  it('maps a unique constraint violation to a conflict', () => {
    expect(appErrorByPrismaCode('P2002')).toBe(AppError.CONFLICT);
  });

  it('maps a foreign key violation to a conflict', () => {
    expect(appErrorByPrismaCode('P2003')).toBe(AppError.CONFLICT);
  });

  it('maps a missing record to not found', () => {
    expect(appErrorByPrismaCode('P2025')).toBe(AppError.NOT_FOUND);
  });

  it('returns null for codes it does not know', () => {
    expect(appErrorByPrismaCode('P1001')).toBeNull();
  });
});

describe('appErrorByStatus', () => {
  it('derives a code from a known status', () => {
    expect(appErrorByStatus(404)).toBe(AppError.NOT_FOUND);
    expect(appErrorByStatus(400)).toBe(AppError.VALIDATION_FAILED);
    expect(appErrorByStatus(409)).toBe(AppError.CONFLICT);
  });

  it('falls back to internal for anything else', () => {
    expect(appErrorByStatus(418)).toBe(AppError.INTERNAL);
  });
});

describe('extractTsRestIssues', () => {
  it('returns null for a body that is not a ts-rest validation error', () => {
    expect(extractTsRestIssues({ message: 'nope' })).toBeNull();
    expect(extractTsRestIssues(null)).toBeNull();
    expect(extractTsRestIssues('string')).toBeNull();
  });

  it('flattens issues from every result key', () => {
    const body = {
      paramsResult: null,
      headersResult: null,
      queryResult: null,
      bodyResult: {
        issues: [
          { path: ['slug'], message: 'Invalid' },
          { path: ['parentId'], message: 'Expected number' },
        ],
      },
    };

    expect(extractTsRestIssues(body)).toEqual([
      { path: 'slug', message: 'Invalid' },
      { path: 'parentId', message: 'Expected number' },
    ]);
  });

  it('returns an empty array when the shape matches but no issues are present', () => {
    expect(extractTsRestIssues({ bodyResult: null, paramsResult: null })).toEqual([]);
  });

  it('joins nested paths with a dot', () => {
    const body = { bodyResult: { issues: [{ path: ['parent', 'id'], message: 'Required' }] } };

    expect(extractTsRestIssues(body)).toEqual([{ path: 'parent.id', message: 'Required' }]);
  });
});
