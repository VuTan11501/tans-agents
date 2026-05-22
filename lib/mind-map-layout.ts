import type { BranchTree, ChatSession } from "@/hooks/use-chat-history"

export const MIND_MAP_NODE_WIDTH = 168
export const MIND_MAP_NODE_HEIGHT = 60
export const MIND_MAP_LEVEL_GAP = 200
export const MIND_MAP_ROW_GAP = 20

export interface MindMapNode {
  id: string
  title: string
  depth: number
  x: number
  y: number
  session: ChatSession
  isVirtual?: boolean
}

export interface MindMapEdge {
  id: string
  from: string
  to: string
  fromX: number
  fromY: number
  toX: number
  toY: number
}

export interface MindMapLayout {
  nodes: MindMapNode[]
  edges: MindMapEdge[]
  width: number
  height: number
}

const ROW_SPACING = MIND_MAP_NODE_HEIGHT + MIND_MAP_ROW_GAP
const PADDING = 48

export function truncateTitle(title: string, max = 24) {
  const normalized = (title || "Cuộc trò chuyện mới").trim() || "Cuộc trò chuyện mới"
  return normalized.length > max ? `${normalized.slice(0, max)}…` : normalized
}

export function layoutMindMap(tree: BranchTree | null): MindMapLayout {
  if (!tree) return { nodes: [], edges: [], width: 0, height: 0 }

  const nodes: MindMapNode[] = []
  const edges: MindMapEdge[] = []
  let leafIndex = 0
  let maxDepth = 0

  function walk(current: BranchTree, depth: number): number {
    maxDepth = Math.max(maxDepth, depth)
    const children = current.children ?? []
    const childYs = children.map((child) => walk(child, depth + 1))
    const y = childYs.length
      ? (Math.min(...childYs) + Math.max(...childYs)) / 2
      : leafIndex++ * ROW_SPACING
    const x = depth * MIND_MAP_LEVEL_GAP
    const isVirtual = current.session.id === "__all__"

    nodes.push({
      id: current.session.id,
      title: truncateTitle(current.session.title),
      depth,
      x,
      y,
      session: current.session,
      isVirtual,
    })

    for (const child of children) {
      const childNodeY = nodes.find((node) => node.id === child.session.id)?.y ?? y
      edges.push({
        id: `${current.session.id}->${child.session.id}`,
        from: current.session.id,
        to: child.session.id,
        fromX: x + MIND_MAP_NODE_WIDTH,
        fromY: y + MIND_MAP_NODE_HEIGHT / 2,
        toX: (depth + 1) * MIND_MAP_LEVEL_GAP,
        toY: childNodeY + MIND_MAP_NODE_HEIGHT / 2,
      })
    }

    return y
  }

  walk(tree, 0)

  return {
    nodes,
    edges,
    width: maxDepth * MIND_MAP_LEVEL_GAP + MIND_MAP_NODE_WIDTH + PADDING * 2,
    height: Math.max(MIND_MAP_NODE_HEIGHT + PADDING * 2, leafIndex * ROW_SPACING + PADDING * 2),
  }
}
