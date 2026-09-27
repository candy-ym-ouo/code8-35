import { Prisma, type ActivityEntityType } from '@prisma/client';

export interface DeletedEntityIds {
  bookIds: string[];
  dogEarIds: string[];
  annotationIds: string[];
  rereadMarkIds: string[];
  reflectionIds: string[];
}

/**
 * 构造导出时间线事件的过滤条件，与对象明细保持同一口径：
 * 未选择包含软删除对象时，引用已删除对象（或所属已删除书目）的事件一并排除，
 * 避免事件 payload 带出已删除痕迹的标题、摘录或原因。
 */
export function activityEventExportWhere(
  userId: string,
  deleted: DeletedEntityIds
): Prisma.ActivityEventWhereInput {
  const and: Prisma.ActivityEventWhereInput[] = [];
  if (deleted.bookIds.length > 0) {
    and.push({ OR: [{ bookId: null }, { bookId: { notIn: deleted.bookIds } }] });
  }
  const perType: Array<[ActivityEntityType, string[]]> = [
    ['BOOK', deleted.bookIds],
    ['DOG_EAR', deleted.dogEarIds],
    ['ANNOTATION', deleted.annotationIds],
    ['REREAD_MARK', deleted.rereadMarkIds],
    ['COMPLETION_REFLECTION', deleted.reflectionIds]
  ];
  for (const [entityType, ids] of perType) {
    if (ids.length > 0) {
      and.push({ NOT: { entityType, entityId: { in: ids } } });
    }
  }
  return and.length > 0 ? { userId, AND: and } : { userId };
}
