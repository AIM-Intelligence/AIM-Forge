import { useEffect, useMemo, useState } from "react";
import { projectApi, ApiError } from "../../../utils/api";
import type {
  PackageInfo,
  PackageMetadata,
  PackageActionInfo,
} from "../../../types";

interface PackageManagerPanelProps {
  projectId: string;
}

interface LogState {
  title: string;
  content: string;
}

export default function PackageManagerPanel({ projectId }: PackageManagerPanelProps) {
  const [packageList, setPackageList] = useState<PackageInfo[]>([]);
  const [metadata, setMetadata] = useState<PackageMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [installing, setInstalling] = useState(false);
  const [uninstalling, setUninstalling] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorLogPath, setErrorLogPath] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [logState, setLogState] = useState<LogState | null>(null);
  const [isFetchingLog, setIsFetchingLog] = useState(false);

  useEffect(() => {
    fetchPackages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const lastAction = useMemo<PackageActionInfo | null>(() => {
    return metadata?.last_action ?? null;
  }, [metadata]);

  async function fetchPackages() {
    setIsLoading(true);
    setErrorMessage(null);
    setErrorLogPath(null);
    try {
      const result = await projectApi.listPackages(projectId);
      setPackageList(result.packages || []);
      setMetadata(result.metadata || null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "패키지 목록을 불러오지 못했습니다.";
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleInstall() {
    const value = inputValue.trim();
    if (!value) {
      setErrorMessage("설치할 패키지명을 입력하세요.");
      return;
    }

    setInstalling(true);
    setErrorMessage(null);
    setErrorLogPath(null);
    setSuccessMessage(null);

    try {
      const packagesToInstall = value.includes(',') ? value.split(',').map((pkg) => pkg.trim()).filter(Boolean) : value;
      const result = await projectApi.installPackage(projectId, packagesToInstall as string | string[]);
      setPackageList(result.packages || []);
      setMetadata(result.metadata || null);
      setSuccessMessage(`'${value}' 설치가 완료되었습니다.`);
      setInputValue("");
    } catch (err) {
      if (err instanceof ApiError) {
        const payload = err.payload as { message?: string; log_path?: string } | undefined;
        setErrorMessage(payload?.message || err.message);
        if (payload?.log_path) {
          setErrorLogPath(payload.log_path);
        }
      } else if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage("패키지 설치에 실패했습니다.");
      }
    } finally {
      setInstalling(false);
    }
  }

  async function handleUninstall(pkg: PackageInfo) {
    setUninstalling(pkg.name);
    setErrorMessage(null);
    setErrorLogPath(null);
    setSuccessMessage(null);
    try {
      const result = await projectApi.uninstallPackage(projectId, pkg.name);
      setPackageList(result.packages || []);
      setMetadata(result.metadata || null);
      setSuccessMessage(`'${pkg.name}' 삭제가 완료되었습니다.`);
    } catch (err) {
      if (err instanceof ApiError) {
        const payload = err.payload as { message?: string; log_path?: string } | undefined;
        setErrorMessage(payload?.message || err.message);
        if (payload?.log_path) {
          setErrorLogPath(payload.log_path);
        }
      } else if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage("패키지 삭제에 실패했습니다.");
      }
    } finally {
      setUninstalling(null);
    }
  }

  async function handleViewLog(logPath?: string | null) {
    if (!logPath) return;
    setIsFetchingLog(true);
    setErrorMessage(null);
    try {
      const result = await projectApi.getPackageLog(projectId, logPath);
      setLogState({
        title: result.log_path,
        content: result.content,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "로그를 불러오지 못했습니다.";
      setErrorMessage(message);
    } finally {
      setIsFetchingLog(false);
    }
  }

  const renderPackages = () => {
    if (isLoading) {
      return (
        <div className="py-4 text-sm text-neutral-400">패키지 정보를 불러오는 중...</div>
      );
    }

    if (!packageList.length) {
      return (
        <div className="py-4 text-sm text-neutral-500">설치된 패키지가 없습니다.</div>
      );
    }

    return (
      <div className="max-h-48 overflow-y-auto divide-y divide-neutral-800 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-neutral-800 [&::-webkit-scrollbar-thumb]:bg-neutral-600 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb:hover]:bg-neutral-500">
        {packageList.map((pkg) => (
          <div key={pkg.name} className="flex items-center justify-between py-2 text-sm pr-2">
            <div>
              <div className="text-white font-medium">{pkg.name}</div>
              <div className="text-neutral-400 text-xs">{pkg.version}</div>
            </div>
            <button
              onClick={() => handleUninstall(pkg)}
              disabled={uninstalling === pkg.name || installing}
              className="px-3 py-1 text-xs rounded border border-red-500 text-red-500 hover:bg-red-500/10 disabled:opacity-40 -mr-0.5"
            >
              {uninstalling === pkg.name ? "삭제중" : "삭제"}
            </button>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="w-full bg-neutral-900 border border-neutral-700 rounded-lg shadow-inner">
      <div className="p-3 border-b border-neutral-700 space-y-2">
        <div className="text-sm font-semibold text-white">패키지 설치</div>
        <div className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="예: requests 또는 pandas==2.3.2"
            className="flex-1 px-3 py-2 text-sm bg-neutral-800 border border-neutral-600 rounded focus:outline-none focus:border-red-500 text-white"
            disabled={installing}
          />
          <button
            onClick={handleInstall}
            disabled={installing}
            className="px-3 py-2 text-sm bg-red-700 hover:bg-red-600 rounded text-white disabled:opacity-50"
          >
            {installing ? "설치중" : "설치"}
          </button>
        </div>
        <p className="text-xs text-neutral-500">
          여러 패키지를 설치하려면 공백 없이 콤마로 구분하거나, 각각 설치하세요.
        </p>
      </div>

      {errorMessage && (
        <div className="px-3 py-2 text-sm text-red-300 bg-red-900/30 border-b border-red-700">
          <div className="flex items-center justify-between">
            <span>{errorMessage}</span>
            {errorLogPath && (
              <button
                className="text-xs underline ml-3"
                onClick={() => handleViewLog(errorLogPath)}
                disabled={isFetchingLog}
              >
                {isFetchingLog ? "로그 불러오는 중" : "로그 보기"}
              </button>
            )}
          </div>
        </div>
      )}

      {successMessage && (
        <div className="px-3 py-2 text-sm text-green-300 bg-green-900/20 border-b border-green-700">
          {successMessage}
        </div>
      )}

      <div className="p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-semibold text-white">설치된 패키지</div>
          <button
            onClick={fetchPackages}
            disabled={isLoading || installing}
            className="p-2 text-sm border border-neutral-600 rounded text-neutral-200 hover:bg-neutral-800 disabled:opacity-50 flex items-center justify-center"
            title="패키지 목록 새로고침"
          >
            <img
              src="/refresh.svg"
              alt="새로고침"
              className="w-4 h-4"
            />
          </button>
        </div>
        {renderPackages()}
      </div>

      <div className="border-t border-neutral-800 p-3 space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-white font-semibold">최근 작업</span>
          {lastAction?.log_path && (
            <button
              className="text-xs text-red-400 underline"
              onClick={() => handleViewLog(lastAction.log_path || undefined)}
              disabled={isFetchingLog}
            >
              {isFetchingLog ? "로그 불러오는 중" : "로그 보기"}
            </button>
          )}
        </div>
        {lastAction ? (
          <div className="text-neutral-300 text-xs space-y-1">
            <div>동작: {lastAction.action}</div>
            <div>
              패키지: {lastAction.packages && lastAction.packages.length ? lastAction.packages.join(", ") : "(없음)"}
            </div>
            <div>결과: {lastAction.success ? "성공" : "실패"}</div>
            <div>
              시간: {lastAction.timestamp ? new Date(lastAction.timestamp).toLocaleString() : "-"}
            </div>
            {lastAction.log_path && (
              <div className="text-neutral-500">로그: {lastAction.log_path}</div>
            )}
          </div>
        ) : (
          <div className="text-xs text-neutral-500">최근 작업 정보가 없습니다.</div>
        )}
      </div>

      {logState && (
        <div className="border-t border-neutral-800 p-3 bg-neutral-950/70">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-white">로그 미리보기</span>
            <button
              onClick={() => setLogState(null)}
              className="text-xs text-neutral-400 hover:text-white"
            >
              닫기
            </button>
          </div>
          <div className="text-xs text-neutral-500 mb-2">{logState.title}</div>
          <pre className="bg-neutral-900 border border-neutral-700 rounded p-3 text-xs text-neutral-200 max-h-64 overflow-y-auto whitespace-pre-wrap [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-neutral-800 [&::-webkit-scrollbar-thumb]:bg-neutral-600 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb:hover]:bg-neutral-500">
            {logState.content}
          </pre>
        </div>
      )}
    </div>
  );
}
