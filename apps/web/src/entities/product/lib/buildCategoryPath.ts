

export function categoryDescendantsParam(categoryPath: string): [string, string] {
  return ["category_path:startsWith", `${categoryPath}.`];
}

export function categorySelfParam(categoryPath: string): [string, string] {
  return ["category_path", categoryPath];
}
