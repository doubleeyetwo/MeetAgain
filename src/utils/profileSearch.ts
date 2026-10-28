// Share text matching without coupling screens to a particular member/friend row type.
export function matchesProfileSearch(
  query: string,
  displayName: string,
  username: string,
): boolean {
  // Ignore surrounding query spaces and capitalization, as the friends list does.
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const searchText = `${displayName} ${username}`.toLocaleLowerCase();
  return !normalizedQuery || searchText.includes(normalizedQuery);
}
