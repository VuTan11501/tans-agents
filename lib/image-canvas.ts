export type DrawTool = "pen" | "eraser"

export type CanvasPoint = {
  x: number
  y: number
}

type Stroke = {
  color: string
  size: number
  tool: DrawTool
  points: CanvasPoint[]
}

export class ImageCanvasMarkup {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private overlay: HTMLCanvasElement
  private overlayCtx: CanvasRenderingContext2D
  private baseImage: HTMLImageElement | null = null
  private strokes: Stroke[] = []
  private activeStroke: Stroke | null = null
  private color = "#ef4444"
  private size = 6
  private tool: DrawTool = "pen"

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("Không khởi tạo được canvas")
    this.canvas = canvas
    this.ctx = ctx
    this.overlay = document.createElement("canvas")
    const overlayCtx = this.overlay.getContext("2d")
    if (!overlayCtx) throw new Error("Không khởi tạo được lớp vẽ")
    this.overlayCtx = overlayCtx
  }

  setTool(tool: DrawTool) {
    this.tool = tool
  }

  setColor(color: string) {
    this.color = color
  }

  setSize(size: number) {
    this.size = size
  }

  async loadImage(src: string, maxWidth = 800, maxHeight = 600) {
    const image = new Image()
    image.decoding = "async"
    image.src = src
    await image.decode()

    const scale = Math.min(1, maxWidth / image.naturalWidth, maxHeight / image.naturalHeight)
    const width = Math.max(1, Math.round(image.naturalWidth * scale))
    const height = Math.max(1, Math.round(image.naturalHeight * scale))

    this.canvas.width = width
    this.canvas.height = height
    this.overlay.width = width
    this.overlay.height = height
    this.baseImage = image
    this.strokes = []
    this.activeStroke = null
    this.render()
  }

  getPoint(event: { clientX: number; clientY: number }): CanvasPoint {
    const rect = this.canvas.getBoundingClientRect()
    const scaleX = this.canvas.width / rect.width
    const scaleY = this.canvas.height / rect.height
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    }
  }

  start(point: CanvasPoint) {
    this.activeStroke = {
      color: this.color,
      size: this.size,
      tool: this.tool,
      points: [point],
    }
    this.strokes.push(this.activeStroke)
    this.render()
  }

  move(point: CanvasPoint) {
    if (!this.activeStroke) return
    this.activeStroke.points.push(point)
    this.render()
  }

  end() {
    this.activeStroke = null
  }

  undo() {
    this.strokes.pop()
    this.activeStroke = null
    this.render()
  }

  clear() {
    this.strokes = []
    this.activeStroke = null
    this.render()
  }

  canUndo() {
    return this.strokes.length > 0
  }

  exportPng() {
    this.render()
    return this.canvas.toDataURL("image/png")
  }

  private render() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    if (this.baseImage) {
      this.ctx.drawImage(this.baseImage, 0, 0, this.canvas.width, this.canvas.height)
    }

    this.overlayCtx.clearRect(0, 0, this.overlay.width, this.overlay.height)
    for (const stroke of this.strokes) {
      this.drawStroke(this.overlayCtx, stroke)
    }

    this.ctx.drawImage(this.overlay, 0, 0)
  }

  private drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke) {
    const [first, ...rest] = stroke.points
    if (!first) return

    ctx.save()
    ctx.globalCompositeOperation = stroke.tool === "eraser" ? "destination-out" : "source-over"
    ctx.strokeStyle = stroke.color
    ctx.fillStyle = stroke.color
    ctx.lineWidth = stroke.size
    ctx.lineCap = "round"
    ctx.lineJoin = "round"

    if (rest.length === 0) {
      ctx.beginPath()
      ctx.arc(first.x, first.y, stroke.size / 2, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
      return
    }

    ctx.beginPath()
    ctx.moveTo(first.x, first.y)
    for (const point of rest) {
      ctx.lineTo(point.x, point.y)
    }
    ctx.stroke()
    ctx.restore()
  }
}
