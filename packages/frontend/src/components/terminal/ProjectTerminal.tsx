import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "@xterm/addon-fit";
import "xterm/css/xterm.css";

type ConnectionState = "connecting" | "open" | "closed" | "error";

interface ProjectTerminalProps {
  projectId: string;
  onExit?: () => void;
}

const decoder = new TextDecoder();

export default function ProjectTerminal({ projectId, onExit }: ProjectTerminalProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  const [connectionState, setConnectionState] = useState<ConnectionState>("connecting");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const writeToTerminal = useCallback((data: string | ArrayBufferLike) => {
    const terminal = termRef.current;
    if (!terminal) return;

    if (typeof data === "string") {
      terminal.write(data);
      return;
    }
    const view = new Uint8Array(data);
    if (view.length === 0) return;
    terminal.write(decoder.decode(view, { stream: true }));
  }, []);

  const sendMessage = useCallback((message: unknown) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    try {
      socket.send(JSON.stringify(message));
    } catch (error) {
      console.error("Failed to send terminal message", error);
    }
  }, []);

  const sendResize = useCallback(() => {
    const terminal = termRef.current;
    if (!terminal) return;
    sendMessage({
      type: "resize",
      cols: terminal.cols,
      rows: terminal.rows,
    });
  }, [sendMessage]);

  const fitTerminal = useCallback(() => {
    const fitAddon = fitAddonRef.current;
    if (!fitAddon) return;
    fitAddon.fit();
    sendResize();
  }, [sendResize]);

  const defaultWsUrl = useMemo(() => {
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    return `${protocol}://${window.location.host}/api/ws/terminal/${projectId}`;
  }, [projectId]);

  const fallbackWsUrl = useMemo(() => {
    const base = import.meta.env.VITE_API_URL as string | undefined;
    if (base && base.startsWith("http")) {
      try {
        const parsed = new URL(base);
        const wsProtocol = parsed.protocol === "https:" ? "wss" : "ws";
        return `${wsProtocol}://${parsed.host}/api/ws/terminal/${projectId}`;
      } catch (error) {
        console.warn("Failed to parse VITE_API_URL for websocket fallback", error);
      }
    }

    // Default fallback assumes backend 개발 서버가 localhost:8000에 있음
    const isHttps = window.location.protocol === "https:";
    const fallbackHost = window.location.hostname || "localhost";
    return `${isHttps ? "wss" : "ws"}://${fallbackHost}:8000/api/ws/terminal/${projectId}`;
  }, [projectId]);

  const connect = useCallback((attempt = 0) => {
    const targetUrl = attempt === 0 ? defaultWsUrl : fallbackWsUrl;

    setConnectionState("connecting");
    setErrorMessage(null);

    let hasOpened = false;
    const socket = new WebSocket(targetUrl);
    socket.binaryType = "arraybuffer";
    socketRef.current = socket;

    socket.addEventListener("open", () => {
      hasOpened = true;
      setConnectionState("open");
      termRef.current?.focus();
      fitTerminal();
    });

    socket.addEventListener("message", (event) => {
      if (event.data instanceof ArrayBuffer) {
        writeToTerminal(event.data);
      } else if (typeof event.data === "string") {
        writeToTerminal(event.data);
      }
    });

    socket.addEventListener("error", (event) => {
      console.error("Terminal socket error", event);
      if (attempt > 0 || hasOpened) {
        setConnectionState("error");
        setErrorMessage("연결 오류가 발생했습니다. 다시 시도하세요.");
      }
    });

    socket.addEventListener("close", (event) => {
      if (!hasOpened && attempt === 0 && fallbackWsUrl && fallbackWsUrl !== defaultWsUrl) {
        setTimeout(() => connect(1), 250);
        return;
      }
      setConnectionState("closed");
      if (event.reason) {
        setErrorMessage(event.reason);
      }
    });
  }, [defaultWsUrl, fallbackWsUrl, fitTerminal, writeToTerminal]);

  useEffect(() => {
    const terminal = new Terminal({
      allowTransparency: true,
      cursorBlink: true,
      fontFamily: "'Fira Code', 'JetBrains Mono', Menlo, monospace",
      fontSize: 13,
      theme: {
        background: "#09090b",
        foreground: "#f8fafc",
        cursor: "#f87171",
      },
    });
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    termRef.current = terminal;
    fitAddonRef.current = fitAddon;

    const handleData = terminal.onData((data) => {
      sendMessage({ type: "input", data });
    });

    if (containerRef.current) {
      terminal.open(containerRef.current);
      fitAddon.fit();
      terminal.focus();
    }

    connect();

    resizeObserverRef.current = new ResizeObserver(() => {
      fitTerminal();
    });
    if (containerRef.current) {
      resizeObserverRef.current.observe(containerRef.current);
    }

    return () => {
      handleData.dispose();
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;

      try {
        sendMessage({ type: "close" });
      } catch {
        // ignore
      }

      const socket = socketRef.current;
      socketRef.current = null;
      socket?.close();

      terminal.dispose();
      termRef.current = null;
      fitAddonRef.current = null;
    };
  }, [connect, fitTerminal, sendMessage]);

  const statusLabel = useMemo(() => {
    switch (connectionState) {
      case "connecting":
        return "연결 중";
      case "open":
        return "연결됨";
      case "closed":
        return "연결 종료";
      case "error":
        return "오류";
      default:
        return "";
    }
  }, [connectionState]);

  const reconnect = useCallback(() => {
    socketRef.current?.close();
    connect();
  }, [connect]);

  return (
    <div className="flex flex-col h-full w-full text-neutral-200">
      <div className="flex items-center justify-between border-b border-neutral-700 px-3 py-2 text-sm">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-white">Terminal</span>
          <span className="text-xs text-neutral-400">{statusLabel}</span>
          {errorMessage && <span className="text-xs text-red-400">{errorMessage}</span>}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={reconnect}
            className="px-2 py-1 rounded bg-neutral-800 text-neutral-300 hover:bg-neutral-700 transition-colors"
          >
            Reconnect
          </button>
          <button
            onClick={() => {
              sendMessage({ type: "close" });
              socketRef.current?.close();
              onExit?.();
            }}
            className="px-2 py-1 rounded bg-neutral-800 text-neutral-300 hover:bg-neutral-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
      <div
        ref={containerRef}
        className="flex-1 bg-black overflow-hidden"
        style={{ minHeight: "320px" }}
      />
    </div>
  );
}
