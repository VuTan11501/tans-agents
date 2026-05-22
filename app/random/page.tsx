"use client";

import { useMemo, useState } from "react";

const LOWER = "abcdefghijklmnopqrstuvwxyz";
const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const DIGITS = "0123456789";
const SYMBOLS = "!@#$%^&*()-_=+[]{};:,.<>?";
const DICE_SIDES = [4, 6, 8, 10, 12, 20, 100];

function randomInt(min: number, max: number): number {
  const range = max - min + 1;
  if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || range <= 0 || range > 0x100000000) {
    throw new Error("Khoảng số phải hợp lệ và không vượt quá 4,294,967,296 giá trị.");
  }

  const limit = Math.floor(0x100000000 / range) * range;
  const buffer = new Uint32Array(1);
  let value = 0;

  do {
    crypto.getRandomValues(buffer);
    value = buffer[0];
  } while (value >= limit);

  return min + (value % range);
}

function pickChar(chars: string): string {
  return chars[randomInt(0, chars.length - 1)];
}

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(0, index);
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function createUuidV4(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex
    .slice(8, 10)
    .join("")}-${hex.slice(10, 16).join("")}`;
}

function copyText(value: string) {
  if (value) void navigator.clipboard.writeText(value);
}

export default function RandomPage() {
  const [uuidCount, setUuidCount] = useState(5);
  const [uuids, setUuids] = useState<string[]>(() => Array.from({ length: 5 }, createUuidV4));

  const [passwordLength, setPasswordLength] = useState(16);
  const [useUpper, setUseUpper] = useState(true);
  const [useLower, setUseLower] = useState(true);
  const [useDigits, setUseDigits] = useState(true);
  const [useSymbols, setUseSymbols] = useState(true);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const [minNumber, setMinNumber] = useState("1");
  const [maxNumber, setMaxNumber] = useState("100");
  const [numberResult, setNumberResult] = useState<string>("");
  const [numberError, setNumberError] = useState("");

  const [diceCount, setDiceCount] = useState(2);
  const [diceSides, setDiceSides] = useState(6);
  const [diceResults, setDiceResults] = useState<number[]>([]);

  const [coin, setCoin] = useState<"Sấp" | "Ngửa" | "">("");
  const [isFlipping, setIsFlipping] = useState(false);

  const [optionsText, setOptionsText] = useState("Cà phê\nTrà sữa\nNước lọc");
  const [pickedOption, setPickedOption] = useState("");

  const passwordCharset = useMemo(() => {
    return [useUpper ? UPPER : "", useLower ? LOWER : "", useDigits ? DIGITS : "", useSymbols ? SYMBOLS : ""].join("");
  }, [useDigits, useLower, useSymbols, useUpper]);

  const entropy = passwordCharset ? passwordLength * Math.log2(passwordCharset.length) : 0;
  const strength = entropy >= 100 ? "Rất mạnh" : entropy >= 70 ? "Mạnh" : entropy >= 45 ? "Trung bình" : "Yếu";
  const diceTotal = diceResults.reduce((sum, value) => sum + value, 0);

  function generateUuids() {
    setUuids(Array.from({ length: uuidCount }, createUuidV4));
  }

  function generatePassword() {
    setPasswordError("");
    const requiredSets = [useUpper ? UPPER : "", useLower ? LOWER : "", useDigits ? DIGITS : "", useSymbols ? SYMBOLS : ""].filter(Boolean);

    if (!passwordCharset || requiredSets.length === 0) {
      setPassword("");
      setPasswordError("Hãy chọn ít nhất một nhóm ký tự.");
      return;
    }

    if (passwordLength < requiredSets.length) {
      setPassword("");
      setPasswordError("Độ dài quá ngắn so với số nhóm ký tự đã chọn.");
      return;
    }

    const chars = requiredSets.map(pickChar);
    while (chars.length < passwordLength) chars.push(pickChar(passwordCharset));
    setPassword(shuffle(chars).join(""));
  }

  function generateNumber() {
    setNumberError("");
    const min = Number(minNumber);
    const max = Number(maxNumber);

    try {
      if (!Number.isInteger(min) || !Number.isInteger(max)) throw new Error("Min và max phải là số nguyên.");
      if (min > max) throw new Error("Min phải nhỏ hơn hoặc bằng max.");
      setNumberResult(String(randomInt(min, max)));
    } catch (err) {
      setNumberResult("");
      setNumberError(err instanceof Error ? err.message : "Không thể tạo số.");
    }
  }

  function rollDice() {
    setDiceResults(Array.from({ length: diceCount }, () => randomInt(1, diceSides)));
  }

  function flipCoin() {
    setIsFlipping(true);
    setCoin("");
    window.setTimeout(() => {
      setCoin(randomInt(0, 1) === 0 ? "Sấp" : "Ngửa");
      setIsFlipping(false);
    }, 550);
  }

  function pickOption() {
    const options = optionsText
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);
    setPickedOption(options.length ? options[randomInt(0, options.length - 1)] : "");
  }

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <p className="text-sm font-medium text-muted-foreground">Công cụ bảo mật</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Bộ tạo ngẫu nhiên</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            UUID, mật khẩu, số, dice, coin flip và chọn ngẫu nhiên — tất cả dùng crypto.getRandomValues.
          </p>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">UUID</h2>
                <p className="text-sm text-muted-foreground">Tạo UUID v4 bằng byte ngẫu nhiên an toàn.</p>
              </div>
              <button className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90" onClick={generateUuids} type="button">
                Tạo UUID v4
              </button>
            </div>
            <label className="text-sm font-medium">Số lượng: {uuidCount}</label>
            <input className="mt-2 w-full accent-primary" type="range" min={1} max={50} value={uuidCount} onChange={(event) => setUuidCount(Number(event.target.value))} />
            <textarea
              readOnly
              value={uuids.join("\n")}
              className="mt-4 min-h-40 w-full rounded-xl border border-input bg-background px-4 py-3 font-mono text-xs outline-none"
            />
            <button className="mt-3 rounded-xl border border-border px-4 py-2 text-sm font-medium transition hover:bg-muted" onClick={() => copyText(uuids.join("\n"))} type="button">
              Sao chép tất cả
            </button>
          </section>

          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h2 className="text-xl font-semibold">Mật khẩu</h2>
            <div className="mt-4">
              <label className="text-sm font-medium">Độ dài: {passwordLength}</label>
              <input className="mt-2 w-full accent-primary" type="range" min={8} max={64} value={passwordLength} onChange={(event) => setPasswordLength(Number(event.target.value))} />
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {[
                ["Chữ hoa", useUpper, setUseUpper],
                ["Chữ thường", useLower, setUseLower],
                ["Số", useDigits, setUseDigits],
                ["Ký tự đặc biệt", useSymbols, setUseSymbols],
              ].map(([label, checked, setter]) => (
                <label key={String(label)} className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm">
                  <input type="checkbox" checked={Boolean(checked)} onChange={(event) => (setter as (value: boolean) => void)(event.target.checked)} className="accent-primary" />
                  {label as string}
                </label>
              ))}
            </div>
            <button className="mt-4 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90" onClick={generatePassword} type="button">
              Tạo mật khẩu
            </button>
            <div className="mt-4 rounded-xl border border-border bg-background p-3">
              <code className="block break-all font-mono text-sm">{password || "—"}</code>
            </div>
            <div className="mt-3 flex items-center justify-between rounded-xl bg-muted p-3 text-sm">
              <span>Độ mạnh: {strength}</span>
              <span className="font-mono">{entropy.toFixed(1)} bits</span>
            </div>
            {passwordError ? <p className="mt-2 text-sm text-destructive">{passwordError}</p> : null}
          </section>

          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h2 className="text-xl font-semibold">Số ngẫu nhiên</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium">
                Min
                <input className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring/20" value={minNumber} onChange={(event) => setMinNumber(event.target.value)} inputMode="numeric" />
              </label>
              <label className="text-sm font-medium">
                Max
                <input className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring/20" value={maxNumber} onChange={(event) => setMaxNumber(event.target.value)} inputMode="numeric" />
              </label>
            </div>
            <button className="mt-4 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90" onClick={generateNumber} type="button">
              Tạo
            </button>
            <div className="mt-4 rounded-xl bg-muted p-4 text-center font-mono text-3xl font-bold">{numberResult || "—"}</div>
            {numberError ? <p className="mt-2 text-sm text-destructive">{numberError}</p> : null}
          </section>

          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h2 className="text-xl font-semibold">Xí ngầu / Dice</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium">
                Số viên: {diceCount}
                <input className="mt-2 w-full accent-primary" type="range" min={1} max={10} value={diceCount} onChange={(event) => setDiceCount(Number(event.target.value))} />
              </label>
              <label className="text-sm font-medium">
                Số mặt
                <select className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring/20" value={diceSides} onChange={(event) => setDiceSides(Number(event.target.value))}>
                  {DICE_SIDES.map((side) => (
                    <option key={side} value={side}>d{side}</option>
                  ))}
                </select>
              </label>
            </div>
            <button className="mt-4 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90" onClick={rollDice} type="button">
              Roll
            </button>
            <div className="mt-4 rounded-xl bg-muted p-4">
              <p className="font-mono text-lg">{diceResults.length ? diceResults.join(" + ") : "—"}</p>
              <p className="mt-1 text-sm text-muted-foreground">Tổng: {diceResults.length ? diceTotal : "—"}</p>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h2 className="text-xl font-semibold">Coin flip</h2>
            <button className="mt-4 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90" onClick={flipCoin} type="button">
              Tung đồng xu
            </button>
            <div className="mt-6 flex justify-center">
              <div className={`grid h-32 w-32 place-items-center rounded-full border border-border bg-muted text-2xl font-bold shadow-sm transition-transform duration-500 ${isFlipping ? "rotate-[720deg] scale-110" : ""}`}>
                {isFlipping ? "..." : coin || "?"}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h2 className="text-xl font-semibold">Chọn ngẫu nhiên</h2>
            <p className="mt-1 text-sm text-muted-foreground">Nhập mỗi lựa chọn trên một dòng.</p>
            <textarea className="mt-4 min-h-32 w-full rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring/20" value={optionsText} onChange={(event) => setOptionsText(event.target.value)} />
            <button className="mt-4 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90" onClick={pickOption} type="button">
              Chọn 1
            </button>
            <div className="mt-4 rounded-xl border border-primary/30 bg-primary/10 p-4 text-center text-lg font-semibold text-primary">
              {pickedOption || "Chưa chọn"}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
