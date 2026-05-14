const DAY_MS = 24 * 60 * 60 * 1000;

export function normalizeSearchText(value) {
  return (value || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getWords(value) {
  return normalizeSearchText(value).split(' ').filter(Boolean);
}

function getLevenshteinDistance(source, target, maxDistance) {
  const sourceLength = source.length;
  const targetLength = target.length;

  if (Math.abs(sourceLength - targetLength) > maxDistance) return maxDistance + 1;

  const previous = Array.from({ length: targetLength + 1 }, (_, index) => index);
  const current = new Array(targetLength + 1);

  for (let sourceIndex = 1; sourceIndex <= sourceLength; sourceIndex += 1) {
    current[0] = sourceIndex;
    let minInRow = current[0];

    for (let targetIndex = 1; targetIndex <= targetLength; targetIndex += 1) {
      const cost = source[sourceIndex - 1] === target[targetIndex - 1] ? 0 : 1;
      current[targetIndex] = Math.min(
        previous[targetIndex] + 1,
        current[targetIndex - 1] + 1,
        previous[targetIndex - 1] + cost,
      );
      minInRow = Math.min(minInRow, current[targetIndex]);
    }

    if (minInRow > maxDistance) return maxDistance + 1;

    for (let index = 0; index <= targetLength; index += 1) {
      previous[index] = current[index];
    }
  }

  return previous[targetLength];
}

function hasFuzzyWordMatch(nameWords, queryWords) {
  return queryWords.every((queryWord) => {
    const maxDistance = queryWord.length >= 6 ? 2 : 1;

    return nameWords.some((nameWord) => {
      if (Math.abs(nameWord.length - queryWord.length) > maxDistance) return false;
      return getLevenshteinDistance(nameWord, queryWord, maxDistance) <= maxDistance;
    });
  });
}

function getMatchScore(productName, query) {
  const normalizedName = normalizeSearchText(productName);
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return 0;
  if (!normalizedName) return -1;

  const nameWords = getWords(normalizedName);
  const queryWords = getWords(normalizedQuery);

  if (normalizedName === normalizedQuery) return 1200;
  if (normalizedName.startsWith(normalizedQuery)) return 950;
  if (queryWords.every((word) => nameWords.some((nameWord) => nameWord.startsWith(word)))) return 820;
  if (nameWords.some((word) => word.startsWith(normalizedQuery))) return 720;
  if (queryWords.every((word) => normalizedName.includes(word))) return 620;
  if (normalizedName.includes(normalizedQuery)) return 520;
  if (hasFuzzyWordMatch(nameWords, queryWords)) return 360;

  return -1;
}

function getRecencyBoost(dateString) {
  if (!dateString) return 0;

  const diffDays = Math.max(0, Math.floor((Date.now() - new Date(dateString).getTime()) / DAY_MS));
  if (diffDays <= 3) return 140;
  if (diffDays <= 7) return 100;
  if (diffDays <= 15) return 60;
  if (diffDays <= 30) return 30;
  return 0;
}

export function buildProductInsights(rows) {
  const insights = {};

  rows.forEach((row) => {
    if (!row.product_id) return;

    if (!insights[row.product_id]) {
      insights[row.product_id] = {
        totalUses: 0,
        lastAddedAt: null,
        lastPurchasedAt: null,
      };
    }

    const insight = insights[row.product_id];
    insight.totalUses += 1;

    if (row.added_at && (!insight.lastAddedAt || new Date(row.added_at) > new Date(insight.lastAddedAt))) {
      insight.lastAddedAt = row.added_at;
    }

    if (row.archived_at && (!insight.lastPurchasedAt || new Date(row.archived_at) > new Date(insight.lastPurchasedAt))) {
      insight.lastPurchasedAt = row.archived_at;
    }
  });

  return insights;
}

export function getSortedProductMatches(products, query, insights = {}) {
  const normalizedQuery = normalizeSearchText(query);

  return products
    .map((product) => {
      const insight = insights[product.id] || {};
      const matchScore = getMatchScore(product.name, normalizedQuery);

      if (normalizedQuery && matchScore < 0) return null;

      return {
        product,
        insight,
        score: matchScore
          + Math.min(insight.totalUses || 0, 10) * 14
          + getRecencyBoost(insight.lastPurchasedAt || insight.lastAddedAt),
        normalizedName: normalizeSearchText(product.name),
      };
    })
    .filter(Boolean)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      if ((right.insight.totalUses || 0) !== (left.insight.totalUses || 0)) {
        return (right.insight.totalUses || 0) - (left.insight.totalUses || 0);
      }

      const rightDate = right.insight.lastPurchasedAt || right.insight.lastAddedAt || '';
      const leftDate = left.insight.lastPurchasedAt || left.insight.lastAddedAt || '';
      if (rightDate !== leftDate) return rightDate.localeCompare(leftDate);

      return left.normalizedName.localeCompare(right.normalizedName);
    })
    .map((entry) => entry.product);
}

export function formatLastPurchaseText(archivedAt) {
  if (!archivedAt) return null;

  const purchaseDate = new Date(archivedAt);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const purchaseDay = new Date(purchaseDate);
  purchaseDay.setHours(0, 0, 0, 0);

  const diffDays = Math.round((today.getTime() - purchaseDay.getTime()) / DAY_MS);

  if (diffDays <= 0) return 'Ultima compra hoje';
  if (diffDays === 1) return 'Ultima compra ha 1 dia';
  return `Ultima compra ha ${diffDays} dias`;
}