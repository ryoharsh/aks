export function pageRange(page = 0, pageSize = 20) {
    const safePage = Math.max(0, page);
    const safePageSize = Math.min(50, Math.max(1, pageSize));
    const from = safePage * safePageSize;
    return { from, to: from + safePageSize - 1, pageSize: safePageSize };
}
