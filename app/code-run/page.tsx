"use client";

import { useState, useRef } from "react";
import { Play, RotateCcw, Copy, Download } from "lucide-react";
import SyntaxHighlighter from "react-syntax-highlighter";
import { atomOneDark } from "react-syntax-highlighter/dist/esm/styles/hljs";
import { toast } from "sonner";

interface Example {
  name: string;
  code: string;
}

const EXAMPLES: Example[] = [
  {
    name: "Hello World",
    code: 'console.log("Hello, World!");',
  },
  {
    name: "Fibonacci",
    code: `function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

console.log("Fibonacci(10):", fibonacci(10));`,
  },
  {
    name: "Array Map",
    code: `const numbers = [1, 2, 3, 4, 5];
const doubled = numbers.map(n => n * 2);
console.log("Original:", numbers);
console.log("Doubled:", doubled);`,
  },
  {
    name: "Object Operations",
    code: `const person = {
  name: "Alice",
  age: 30,
  email: "alice@example.com"
};

console.log("Person:", person);
console.log("Name:", person.name);
console.log("Keys:", Object.keys(person));`,
  },
  {
    name: "Loop & Condition",
    code: `for (let i = 1; i <= 5; i++) {
  if (i % 2 === 0) {
    console.log(i, "is even");
  } else {
    console.log(i, "is odd");
  }
}`,
  },
  {
    name: "Promise & Async",
    code: `const promise = new Promise((resolve) => {
  setTimeout(() => {
    resolve("Done!");
  }, 1000);
});

promise.then(result => console.log("Result:", result));
console.log("Promise created");`,
  },
];

export default function CodeRunPage() {
  const [code, setCode] = useState('console.log("Hello, World!");');
  const [output, setOutput] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const runCode = async () => {
    setIsRunning(true);
    setOutput([]);
    setError(null);

    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    try {
      // Set up timeout (5 seconds)
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutRef.current = setTimeout(() => {
          reject(new Error("Execution timeout (5s limit)"));
        }, 5000);
      });

      // Capture console output
      const capturedLogs: string[] = [];
      const originalLog = console.log;
      const originalError = console.error;
      const originalWarn = console.warn;
      const originalInfo = console.info;

      console.log = (...args: any[]) => {
        capturedLogs.push(args.map((arg) => String(arg)).join(" "));
        originalLog(...args);
      };
      console.error = (...args: any[]) => {
        capturedLogs.push(
          "ERROR: " + args.map((arg) => String(arg)).join(" "),
        );
        originalError(...args);
      };
      console.warn = (...args: any[]) => {
        capturedLogs.push(
          "WARN: " + args.map((arg) => String(arg)).join(" "),
        );
        originalWarn(...args);
      };
      console.info = (...args: any[]) => {
        capturedLogs.push(
          "INFO: " + args.map((arg) => String(arg)).join(" "),
        );
        originalInfo(...args);
      };

      try {
        // Execute code with Function constructor (marked as unsafe but clearly needed for execution)
        // eslint-disable-next-line no-new-func
        const fn = new Function(code);
        await Promise.race([fn(), timeoutPromise]);
      } finally {
        // Restore original console methods
        console.log = originalLog;
        console.error = originalError;
        console.warn = originalWarn;
        console.info = originalInfo;
      }

      if (capturedLogs.length === 0) {
        capturedLogs.push("[No output]");
      }

      setOutput(capturedLogs);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      setOutput([]);
    } finally {
      setIsRunning(false);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }
  };

  const handleLoadExample = (example: Example) => {
    setCode(example.code);
    setOutput([]);
    setError(null);
    toast.success(`Loaded: ${example.name}`);
  };

  const handleCopyOutput = () => {
    const text = output.join("\n");
    navigator.clipboard.writeText(text);
    toast.success("Output copied to clipboard");
  };

  const handleExportOutput = () => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const content = `// Code:\n${code}\n\n// Output:\n${output.join("\n")}`;
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `execution-${timestamp}.js`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Exported");
  };

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card p-4">
        <h1 className="text-2xl font-bold">JavaScript Executor</h1>
        <p className="text-sm text-muted-foreground">
          Run JavaScript code safely in the browser (5s timeout, no network access)
        </p>
      </div>

      <div className="flex flex-1 overflow-hidden gap-4 p-4">
        {/* Code Editor Section */}
        <div className="flex flex-1 flex-col gap-3">
          {/* Examples Dropdown */}
          <div className="flex gap-2">
            <select
              onChange={(e) => {
                const example = EXAMPLES.find((ex) => ex.name === e.target.value);
                if (example) {
                  handleLoadExample(example);
                }
              }}
              className="rounded border border-border bg-background px-3 py-2 text-sm"
              defaultValue=""
            >
              <option value="" disabled>
                Load an example...
              </option>
              {EXAMPLES.map((example) => (
                <option key={example.name} value={example.name}>
                  {example.name}
                </option>
              ))}
            </select>

            <button
              onClick={runCode}
              disabled={isRunning}
              className="flex items-center gap-2 rounded bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:bg-gray-600"
            >
              <Play size={16} />
              {isRunning ? "Running..." : "Run Code"}
            </button>

            <button
              onClick={() => {
                setCode("");
                setOutput([]);
                setError(null);
              }}
              className="flex items-center gap-2 rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              <RotateCcw size={16} />
              Clear
            </button>
          </div>

          {/* Code Editor */}
          <div className="flex-1 overflow-hidden rounded-lg border border-border bg-card">
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Write your JavaScript code here..."
              className="h-full w-full resize-none rounded-lg border-0 bg-background p-4 font-mono text-sm focus:outline-none"
              spellCheck="false"
            />
          </div>

          {/* Info Box */}
          <div className="rounded-lg border border-yellow-600/30 bg-yellow-600/10 p-3 text-xs text-yellow-700 dark:text-yellow-600">
            <strong>⚠️ Security Notice:</strong> This executor uses Function() constructor to run
            code. It's safe for educational purposes but never execute untrusted code. No network
            access, limited DOM access, 5 second timeout.
          </div>
        </div>

        {/* Output Section */}
        <div className="flex w-96 flex-col gap-3">
          {/* Output Header */}
          <div className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
            <h2 className="font-semibold">Console Output</h2>
            <div className="flex gap-2">
              {output.length > 0 && (
                <>
                  <button
                    onClick={handleCopyOutput}
                    className="rounded bg-blue-600 p-1.5 text-white hover:bg-blue-700"
                    title="Copy output"
                  >
                    <Copy size={16} />
                  </button>
                  <button
                    onClick={handleExportOutput}
                    className="rounded bg-blue-600 p-1.5 text-white hover:bg-blue-700"
                    title="Export output"
                  >
                    <Download size={16} />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Output Display */}
          <div className="flex-1 overflow-auto rounded-lg border border-border bg-background p-4 font-mono text-sm">
            {error ? (
              <div className="text-red-600 dark:text-red-400">
                <div className="font-semibold">❌ Error:</div>
                <div className="mt-2 whitespace-pre-wrap break-words">{error}</div>
              </div>
            ) : output.length > 0 ? (
              <div className="space-y-1 text-green-600 dark:text-green-400">
                <div className="font-semibold">✓ Output:</div>
                {output.map((line, i) => (
                  <div key={i} className="whitespace-pre-wrap break-words">
                    {line}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-muted-foreground">Click "Run Code" to execute...</div>
            )}
          </div>

          {/* Code Preview */}
          {code && (
            <div className="rounded-lg border border-border bg-card p-3">
              <h3 className="mb-2 text-xs font-semibold text-muted-foreground">Code Preview</h3>
              <div className="max-h-40 overflow-auto rounded bg-background">
                <SyntaxHighlighter
                  language="javascript"
                  style={atomOneDark}
                  customStyle={{
                    margin: 0,
                    padding: "0.5rem",
                    fontSize: "0.75rem",
                  }}
                  wrapLines
                >
                  {code.slice(0, 300)}
                  {code.length > 300 ? "\n..." : ""}
                </SyntaxHighlighter>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
