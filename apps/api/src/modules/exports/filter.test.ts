import { describe, expect, it } from 'vitest';
import { buildExportEventWhere, type DeletedEntityIds } from './filter.js';

function emptyDeletedIds(): DeletedEntityIds {
  return {
    BOOK: [],
    DOG_EAR: [],
    ANNOTATION: [],
    REREAD_MARK: [],
    COMPLETION_REFLECTION: []
  };
}

describe('buildExportEventWhere', () => {
  it('只按用户过滤：包含软删除对象时事件不做额外过滤', () => {
    expect(buildExportEventWhere('user-1', null)).toEqual({ userId: 'user-1' });
  });

  it('排除主体已软删除的事件与已删除书目下的事件', () => {
    const where = buildExportEventWhere('user-1', {
      ...emptyDeletedIds(),
      BOOK: ['book-1'],
      DOG_EAR: ['dog-ear-1'],
      ANNOTATION: ['annotation-1']
    });
    expect(where).toEqual({
      userId: 'user-1',
      AND: [
        { OR: [{ bookId: null }, { book: { deletedAt: null } }] },
        {
          NOT: {
            OR: [
              { entityType: 'BOOK', entityId: { in: ['book-1'] } },
              { entityType: 'DOG_EAR', entityId: { in: ['dog-ear-1'] } },
              { entityType: 'ANNOTATION', entityId: { in: ['annotation-1'] } }
            ]
          }
        }
      ]
    });
  });

  it('没有软删除对象时省略实体排除条件', () => {
    expect(buildExportEventWhere('user-1', emptyDeletedIds())).toEqual({
      userId: 'user-1',
      AND: [{ OR: [{ bookId: null }, { book: { deletedAt: null } }] }]
    });
  });
});
