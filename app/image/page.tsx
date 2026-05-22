"use client";

import { ChangeEvent, DragEvent, useCallback, useEffect, useRef, useState } from "react";

type ImageInfo = { name: string; width: number; height: number; type: string };
type Crop = { x: number; y: number; width: number; height: number };
type OutputFormat = "image/png" | "image/jpeg" | "image/webp";
type Filters = { grayscale: boolean; sepia: boolean; invert: boolean };

const extensionByFormat: Record<OutputFormat, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function parseNumber(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function applyFilters(canvas: HTMLCanvasElement, filters: Filters) {
  if (!filters.grayscale && !filters.sepia && !filters.invert) return;

  const context = canvas.getContext("2d");
  if (!context) return;

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = imageData;

  for (let index = 0; index < data.length; index += 4) {
    let red = data[index];
    let green = data[index + 1];
    let blue = data[index + 2];

    if (filters.grayscale) {
      const gray = 0.299 * red + 0.587 * green + 0.114 * blue;
      red = gray;
      green = gray;
      blue = gray;
    }

    if (filters.sepia) {
      const nextRed = red * 0.393 + green * 0.769 + blue * 0.189;
      const nextGreen = red * 0.349 + green * 0.686 + blue * 0.168;
      const nextBlue = red * 0.272 + green * 0.534 + blue * 0.131;
      red = nextRed;
      green = nextGreen;
      blue = nextBlue;
    }

    if (filters.invert) {
      red = 255 - red;
      green = 255 - green;
      blue = 255 - blue;
    }

    data[index] = clamp(Math.round(red), 0, 255);
    data[index + 1] = clamp(Math.round(green), 0, 255);
    data[index + 2] = clamp(Math.round(blue), 0, 255);
  }

  context.putImageData(imageData, 0, 0);
}

function renderProcessedCanvas(
  image: HTMLImageElement,
  crop: Crop,
  width: number,
  height: number,
  rotation: number,
  filters: Filters,
) {
  const angle = ((rotation % 360) + 360) % 360;
  const radians = (angle * Math.PI) / 180;
  const sin = Math.abs(Math.sin(radians));
  const cos = Math.abs(Math.cos(radians));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * cos + height * sin));
  canvas.height = Math.max(1, Math.round(width * sin + height * cos));

  const context = canvas.getContext("2d");
  if (!context) return canvas;

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.translate(canvas.width / 2, canvas.height / 2);
  context.rotate(radians);
  context.drawImage(image, crop.x, crop.y, crop.width, crop.height, -width / 2, -height / 2, width, height);
  applyFilters(canvas, filters);
  return canvas;
}

export default function ImageToolPage() {
  const imageRef = useRef<HTMLImageElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const resultCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const [imageInfo, setImageInfo] = useState<ImageInfo | null>(null);
  const [imageVersion, setImageVersion] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [resizeWidth, setResizeWidth] = useState(0);
  const [resizeHeight, setResizeHeight] = useState(0);
  const [targetWidth, setTargetWidth] = useState(0);
  const [targetHeight, setTargetHeight] = useState(0);
  const [lockAspect, setLockAspect] = useState(true);
  const [crop, setCrop] = useState<Crop>({ x: 0, y: 0, width: 0, height: 0 });
  const [rotation, setRotation] = useState(0);
  const [format, setFormat] = useState<OutputFormat>("image/png");
  const [quality, setQuality] = useState(0.92);
  const [filters, setFilters] = useState<Filters>({ grayscale: false, sepia: false, invert: false });
  const [message, setMessage] = useState("Chưa có ảnh nào được tải lên.");

  const loadFile = useCallback((file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setMessage("Vui lòng chọn file ảnh hợp lệ.");
      return;
    }

    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const objectUrl = URL.createObjectURL(file);
    objectUrlRef.current = objectUrl;

    const image = new Image();
    image.onload = () => {
      imageRef.current = image;
      const nextInfo = { name: file.name, width: image.naturalWidth, height: image.naturalHeight, type: file.type || "image" };
      setImageInfo(nextInfo);
      setResizeWidth(nextInfo.width);
      setResizeHeight(nextInfo.height);
      setTargetWidth(nextInfo.width);
      setTargetHeight(nextInfo.height);
      setCrop({ x: 0, y: 0, width: nextInfo.width, height: nextInfo.height });
      setRotation(0);
      setFilters({ grayscale: false, sepia: false, invert: false });
      setImageVersion((version) => version + 1);
      setMessage("Ảnh đã sẵn sàng để xử lý trên trình duyệt.");
    };
    image.onerror = () => setMessage("Không thể đọc file ảnh này.");
    image.src = objectUrl;
  }, []);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  const drawPreview = useCallback(() => {
    const image = imageRef.current;
    const canvas = previewCanvasRef.current;
    if (!image || !canvas) return;

    const maxWidth = 720;
    const scale = Math.min(1, maxWidth / image.naturalWidth);
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));

    const context = canvas.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    context.strokeStyle = "#ef4444";
    context.lineWidth = 2;
    context.setLineDash([8, 6]);
    context.strokeRect(crop.x * scale, crop.y * scale, crop.width * scale, crop.height * scale);
    context.fillStyle = "rgba(239, 68, 68, 0.12)";
    context.fillRect(crop.x * scale, crop.y * scale, crop.width * scale, crop.height * scale);
  }, [crop]);

  const drawResult = useCallback(() => {
    const image = imageRef.current;
    const canvas = resultCanvasRef.current;
    if (!image || !canvas) return;

    const processed = renderProcessedCanvas(image, crop, targetWidth || crop.width, targetHeight || crop.height, rotation, filters);
    const maxWidth = 720;
    const scale = Math.min(1, maxWidth / processed.width);
    canvas.width = Math.max(1, Math.round(processed.width * scale));
    canvas.height = Math.max(1, Math.round(processed.height * scale));

    const context = canvas.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(processed, 0, 0, canvas.width, canvas.height);
  }, [crop, filters, rotation, targetHeight, targetWidth]);

  useEffect(() => {
    drawPreview();
    drawResult();
  }, [drawPreview, drawResult, imageVersion]);

  function updateResizeWidth(value: string) {
    const nextWidth = Math.max(1, Math.round(parseNumber(value, resizeWidth)));
    setResizeWidth(nextWidth);
    if (lockAspect && imageInfo) setResizeHeight(Math.max(1, Math.round(nextWidth / (imageInfo.width / imageInfo.height))));
  }

  function updateResizeHeight(value: string) {
    const nextHeight = Math.max(1, Math.round(parseNumber(value, resizeHeight)));
    setResizeHeight(nextHeight);
    if (lockAspect && imageInfo) setResizeWidth(Math.max(1, Math.round(nextHeight * (imageInfo.width / imageInfo.height))));
  }

  function applyResize() {
    setTargetWidth(Math.max(1, Math.round(resizeWidth)));
    setTargetHeight(Math.max(1, Math.round(resizeHeight)));
    setMessage("Đã áp dụng kích thước xuất ảnh.");
  }

  function updateCrop(key: keyof Crop, value: string) {
    if (!imageInfo) return;
    const numberValue = Math.round(parseNumber(value, crop[key]));
    setCrop((current) => {
      const next = { ...current, [key]: numberValue };
      next.x = clamp(next.x, 0, imageInfo.width - 1);
      next.y = clamp(next.y, 0, imageInfo.height - 1);
      next.width = clamp(next.width, 1, imageInfo.width - next.x);
      next.height = clamp(next.height, 1, imageInfo.height - next.y);
      return next;
    });
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    loadFile(event.target.files?.[0] ?? null);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    loadFile(event.dataTransfer.files?.[0] ?? null);
  }

  function toggleFilter(key: keyof Filters) {
    setFilters((current) => ({ ...current, [key]: !current[key] }));
  }

  function downloadImage() {
    const image = imageRef.current;
    if (!image) return;

    const canvas = renderProcessedCanvas(image, crop, targetWidth || crop.width, targetHeight || crop.height, rotation, filters);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setMessage("Không thể tạo file tải xuống.");
          return;
        }
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        const baseName = imageInfo?.name.replace(/\.[^.]+$/, "") || "anh-da-xu-ly";
        link.href = url;
        link.download = `${baseName}.${extensionByFormat[format]}`;
        link.click();
        URL.revokeObjectURL(url);
        setMessage("Đã tạo file tải xuống.");
      },
      format,
      format === "image/png" ? undefined : quality,
    );
  }

  const disabled = !imageInfo;

  return (
    <main className="min-h-screen bg-background p-4 text-foreground md:p-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <section className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Công cụ xử lý ảnh</h1>
              <p className="text-sm text-muted-foreground">Resize, crop, xoay, đổi định dạng và filter bằng canvas, không upload server.</p>
            </div>
            <button
              className="rounded-lg border bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={disabled}
              onClick={downloadImage}
              type="button"
            >
              Tải xuống
            </button>
          </div>
        </section>

        <section
          className={`rounded-lg border border-dashed bg-card p-6 text-center transition ${isDragging ? "border-primary bg-primary/5" : ""}`}
          onDragLeave={() => setIsDragging(false)}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDrop={onDrop}
        >
          <label className="mx-auto flex max-w-xl cursor-pointer flex-col items-center gap-3 rounded-lg border bg-background p-6 hover:bg-muted" htmlFor="image-upload">
            <span className="text-base font-medium">Kéo thả ảnh vào đây hoặc bấm để chọn file</span>
            <span className="text-sm text-muted-foreground">Hỗ trợ PNG, JPG, WebP và các định dạng ảnh trình duyệt đọc được.</span>
            <input accept="image/*" className="sr-only" id="image-upload" onChange={onFileChange} type="file" />
          </label>
          <p className="mt-3 text-sm text-muted-foreground">{message}</p>
        </section>

        {imageInfo ? (
          <section className="grid gap-4 lg:grid-cols-[1fr_360px]">
            <div className="flex flex-col gap-4">
              <div className="rounded-lg border bg-card p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="font-semibold">Preview crop</h2>
                    <p className="text-sm text-muted-foreground">
                      {imageInfo.name} · {imageInfo.width}×{imageInfo.height}px · {imageInfo.type}
                    </p>
                  </div>
                </div>
                <canvas ref={previewCanvasRef} className="max-h-[520px] w-full rounded-lg border bg-background object-contain" />
              </div>

              <div className="rounded-lg border bg-card p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="font-semibold">Preview kết quả</h2>
                    <p className="text-sm text-muted-foreground">
                      Xuất dự kiến: {targetWidth || crop.width}×{targetHeight || crop.height}px · xoay {rotation}°
                    </p>
                  </div>
                </div>
                <canvas ref={resultCanvasRef} className="max-h-[520px] w-full rounded-lg border bg-background object-contain" />
              </div>
            </div>

            <aside className="flex flex-col gap-4">
              <section className="rounded-lg border bg-card p-4">
                <h2 className="mb-3 font-semibold">Resize</h2>
                <div className="grid grid-cols-2 gap-3">
                  <label className="space-y-1">
                    <span className="text-xs font-medium text-muted-foreground">Rộng</span>
                    <input className="w-full rounded-lg border bg-background px-3 py-2 text-sm" min={1} onChange={(event) => updateResizeWidth(event.target.value)} type="number" value={resizeWidth} />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-medium text-muted-foreground">Cao</span>
                    <input className="w-full rounded-lg border bg-background px-3 py-2 text-sm" min={1} onChange={(event) => updateResizeHeight(event.target.value)} type="number" value={resizeHeight} />
                  </label>
                </div>
                <label className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                  <input checked={lockAspect} onChange={(event) => setLockAspect(event.target.checked)} type="checkbox" />
                  Khóa tỉ lệ
                </label>
                <button className="mt-3 w-full rounded-lg border bg-background px-3 py-2 text-sm hover:bg-muted" onClick={applyResize} type="button">
                  Áp dụng
                </button>
              </section>

              <section className="rounded-lg border bg-card p-4">
                <h2 className="mb-3 font-semibold">Crop</h2>
                <div className="grid grid-cols-2 gap-3">
                  {([
                    ["x", "X", imageInfo.width - 1],
                    ["y", "Y", imageInfo.height - 1],
                    ["width", "W", imageInfo.width],
                    ["height", "H", imageInfo.height],
                  ] as const).map(([key, label, max]) => (
                    <label key={key} className="space-y-1">
                      <span className="text-xs font-medium text-muted-foreground">{label}</span>
                      <input
                        className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                        max={max}
                        min={key === "width" || key === "height" ? 1 : 0}
                        onChange={(event) => updateCrop(key, event.target.value)}
                        type="number"
                        value={crop[key]}
                      />
                    </label>
                  ))}
                </div>
              </section>

              <section className="rounded-lg border bg-card p-4">
                <h2 className="mb-3 font-semibold">Xoay ảnh</h2>
                <div className="grid grid-cols-4 gap-2">
                  {[0, 90, 180, 270].map((degree) => (
                    <button className="rounded-lg border bg-background px-2 py-2 text-sm hover:bg-muted" key={degree} onClick={() => setRotation(degree)} type="button">
                      {degree}°
                    </button>
                  ))}
                </div>
                <label className="mt-3 block space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">Xoay tự do: {rotation}°</span>
                  <input className="w-full" max={360} min={0} onChange={(event) => setRotation(Number(event.target.value))} type="range" value={rotation} />
                </label>
              </section>

              <section className="rounded-lg border bg-card p-4">
                <h2 className="mb-3 font-semibold">Định dạng</h2>
                <select className="w-full rounded-lg border bg-background px-3 py-2 text-sm" onChange={(event) => setFormat(event.target.value as OutputFormat)} value={format}>
                  <option value="image/png">PNG</option>
                  <option value="image/jpeg">JPG</option>
                  <option value="image/webp">WebP</option>
                </select>
                <label className="mt-3 block space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">Chất lượng: {Math.round(quality * 100)}%</span>
                  <input className="w-full" disabled={format === "image/png"} max={1} min={0.1} onChange={(event) => setQuality(Number(event.target.value))} step={0.01} type="range" value={quality} />
                </label>
              </section>

              <section className="rounded-lg border bg-card p-4">
                <h2 className="mb-3 font-semibold">Filters</h2>
                <div className="grid gap-2">
                  {([
                    ["grayscale", "Grayscale"],
                    ["sepia", "Sepia"],
                    ["invert", "Invert"],
                  ] as const).map(([key, label]) => (
                    <label className="flex items-center justify-between rounded-lg border bg-background px-3 py-2 text-sm" key={key}>
                      <span>{label}</span>
                      <input checked={filters[key]} onChange={() => toggleFilter(key)} type="checkbox" />
                    </label>
                  ))}
                </div>
              </section>
            </aside>
          </section>
        ) : null}
      </div>
    </main>
  );
}
