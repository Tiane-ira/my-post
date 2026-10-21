import { ApiTreeNode } from './types';

export class TreeUtils {
  /**
   * Recursively counts total APIs (target_type === 'api') inside a folder
   */
  public static countFolderApis(
    tree: ApiTreeNode[],
    folderId: string,
    visited: Set<string> = new Set<string>()
  ): number {
    if (!folderId || visited.has(folderId)) return 0;
    visited.add(folderId);

    let count = 0;
    const directChildren = (tree || []).filter((item) => item && typeof item === 'object' && item.parent_id === folderId);

    for (const child of directChildren) {
      if (child.target_type === 'api' || child.target_type === 'sse' || child.target_type === 'websocket') {
        count += 1;
      } else if (child.target_type === 'folder') {
        count += this.countFolderApis(tree, child.target_id, visited);
      }
    }
    return count;
  }

  /**
   * Retrieves all direct or nested children of a folder
   */
  public static getFolderChildren(
    tree: ApiTreeNode[],
    folderId: string,
    recursive: boolean = false,
    visited: Set<string> = new Set<string>()
  ): ApiTreeNode[] {
    if (!folderId || visited.has(folderId)) return [];
    visited.add(folderId);

    const directChildren = (tree || []).filter((item) => item && typeof item === 'object' && item.parent_id === folderId);
    if (!recursive) {
      return directChildren;
    }

    const allChildren: ApiTreeNode[] = [];
    for (const child of directChildren) {
      allChildren.push(child);
      if (child.target_type === 'folder') {
        allChildren.push(...this.getFolderChildren(tree, child.target_id, true, visited));
      }
    }
    return allChildren;
  }

  /**
   * Builds the breadcrumb path of names from root to target item
   */
  public static buildBreadcrumbs(tree: ApiTreeNode[], targetId: string): string[] {
    const crumbs: string[] = [];
    const visited = new Set<string>();
    let current = (tree || []).find((t) => t && typeof t === 'object' && t.target_id === targetId);

    while (current && !visited.has(current.target_id)) {
      visited.add(current.target_id);
      if (current.name) {
        crumbs.unshift(current.name);
      }
      if (!current.parent_id || current.parent_id === '0') {
        break;
      }
      current = (tree || []).find((t) => t && typeof t === 'object' && t.target_id === current!.parent_id);
    }

    return crumbs;
  }

  /**
   * Retrieves all folder nodes in tree
   */
  public static getAllFolders(tree: ApiTreeNode[]): ApiTreeNode[] {
    return (tree || []).filter((item) => item && typeof item === 'object' && item.target_type === 'folder');
  }

  /**
   * Retrieves the subtree for a given root folder:
   * If rootFolderId is '0', returns the entire tree.
   * Otherwise returns the folder node itself plus all its descendants.
   */
  public static getFolderHierarchy(tree: ApiTreeNode[], rootFolderId: string = '0'): ApiTreeNode[] {
    const safeTree = (tree || []).filter((item) => Boolean(item && typeof item === 'object'));
    if (!rootFolderId || rootFolderId === '0') {
      return safeTree;
    }
    const folder = safeTree.find((t) => t && t.target_id === rootFolderId);
    const descendants = this.getFolderChildren(safeTree, rootFolderId, true);
    return folder ? [folder, ...descendants] : descendants;
  }

  /**
   * Generates a flat, hierarchically ordered list of folder options for dropdowns.
   * Starts with '0' (根目录), followed by subfolders indented by depth.
   */
  public static getOrderedFolderOptions(
    tree: ApiTreeNode[]
  ): Array<{ id: string; name: string; depth: number; path: string; count: number }> {
    const safeTree = tree || [];
    const totalApiCount = safeTree.filter((t) => t.target_type === 'api').length;
    const result: Array<{ id: string; name: string; depth: number; path: string; count: number }> = [
      {
        id: '0',
        name: '根目录 (项目全部接口)',
        depth: 0,
        path: '根目录',
        count: totalApiCount,
      },
    ];

    const visited = new Set<string>();

    const traverse = (parentId: string, depth: number, parentPath: string) => {
      const childFolders = safeTree
        .filter((t) => t.target_type === 'folder' && (t.parent_id || '0') === parentId)
        .sort((a, b) => (a.sort || 0) - (b.sort || 0));

      for (const folder of childFolders) {
        if (visited.has(folder.target_id)) continue;
        visited.add(folder.target_id);

        const currentPath = parentPath ? `${parentPath} / ${folder.name}` : folder.name;
        const count = TreeUtils.countFolderApis(safeTree, folder.target_id);

        result.push({
          id: folder.target_id,
          name: folder.name,
          depth,
          path: currentPath,
          count,
        });

        traverse(folder.target_id, depth + 1, currentPath);
      }
    };

    traverse('0', 1, '');

    // Catch any orphaned folders
    const allFolders = safeTree.filter((t) => t.target_type === 'folder');
    for (const folder of allFolders) {
      if (!visited.has(folder.target_id)) {
        visited.add(folder.target_id);
        const count = TreeUtils.countFolderApis(safeTree, folder.target_id);
        result.push({
          id: folder.target_id,
          name: folder.name,
          depth: 1,
          path: folder.name,
          count,
        });
      }
    }

    return result;
  }
}

