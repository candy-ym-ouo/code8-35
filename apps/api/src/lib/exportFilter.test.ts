import { describe, expect, it } from 'vitest';
import { activityEventExportWhere } from './exportFilter.js';

const noDeleted = {
  bookIds: [],
  dogEarIds: [],
  annotationIds: [],
  rereadMarkIds: [],
  reflectionIds: []
};

describe('activityEventExportWhere', () => {
  it('keeps all user events when nothing is soft-deleted', () => {
    expect(activityEventExportWhere('user-1', noDeleted)).toEqual({ userId: 'user-1' });
  });

  it('excludes events of soft-deleted entities and events under soft-deleted books', () => {
    const where = activityEventExportWhere('user-1', {
      bookIds: ['book-1'],
      dogEarIds: ['dog-ear-1'],
      annotationIds: ['annotation-1'],
      rereadMarkIds: ['reread-1'],
      reflectionIds: ['reflection-1']
    });
    expect(where).toEqual({
      userId: 'user-1',
      AND: [
        { OR: [{ bookId: null }, { bookId: { notIn: ['book-1'] } }] },
        { NOT: { entityType: 'BOOK', entityId: { in: ['book-1'] } } },
        { NOT: { entityType: 'DOG_EAR', entityId: { in: ['dog-ear-1'] } } },
        { NOT: { entityType: 'ANNOTATION', entityId: { in: ['annotation-1'] } } },
        { NOT: { entityType: 'REREAD_MARK', entityId: { in: ['reread-1'] } } },
        { NOT: { entityType: 'COMPLETION_REFLECTION', entityId: { in: ['reflection-1'] } } }
      ]
    });
  });

  it('only adds conditions for entity types that have deleted rows', () => {
    const where = activityEventExportWhere('user-1', { ...noDeleted, annotationIds: ['annotation-9'] });
    expect(where).toEqual({
      userId: 'user-1',
      AND: [{ NOT: { entityType: 'ANNOTATION', entityId: { in: ['annotation-9'] } } }]
    });
  });
});
