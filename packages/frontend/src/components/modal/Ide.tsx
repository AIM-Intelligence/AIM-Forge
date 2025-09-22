import React, { useRef, useEffect, useState, useCallback } from "react";
import Editor from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import type * as Monaco from "monaco-editor";
import SimpleExportButton from "../buttons/ide/SimpleExportButton";
import LoadingModal from "./LoadingModal";
import { codeApi, userComponentApi, ApiError } from "../../utils/api";
import type { UserComponentMetadataDetail } from "../../types";
import X from "../buttons/modal/x";
import { useExecutionStore } from "../../stores/executionStore";

interface IdeModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  nodeId: string;
  nodeTitle: string;
  nodeFile?: string;
  initialCode?: string;
}

interface MetadataPort {
  name: string;
  type: string;
  required?: boolean;
  default?: unknown;
}

interface NodeMetadata {
  inputs?: MetadataPort[];
  outputs?: MetadataPort[];
}

function isMetadata(value: unknown): value is NodeMetadata {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  const inputs = record.inputs;
  const outputs = record.outputs;
  if (inputs !== undefined && !Array.isArray(inputs)) return false;
  if (outputs !== undefined && !Array.isArray(outputs)) return false;
  return true;
}

const IdeModal: React.FC<IdeModalProps> = ({
  isOpen,
  onClose,
  projectId,
  nodeId,
  nodeTitle,
  nodeFile,
  initialCode = "",
}) => {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"loading" | "success" | "error">(
    "loading"
  );
  const [code, setCode] = useState(initialCode);
  const [isLoadingCode, setIsLoadingCode] = useState(true);
  const [runModalOpen, setRunModalOpen] = useState(false);
  const [runStatus, setRunStatus] = useState<"loading" | "success" | "error">(
    "loading"
  );
  const [runResult, setRunResult] = useState<string>("");
  const [isSaveComponentModalOpen, setIsSaveComponentModalOpen] = useState(false);
  const [componentName, setComponentName] = useState(nodeTitle);
  const [componentDescription, setComponentDescription] = useState("");
  const [componentError, setComponentError] = useState<string | null>(null);
  const [isSavingComponent, setIsSavingComponent] = useState(false);
  const setToastMessage = useExecutionStore((state) => state.setToastMessage);

  // Fetch code from backend when modal opens
  const fetchCode = useCallback(async () => {
    if (!projectId || !nodeId) return;

    setIsLoadingCode(true);
    try {
      const data = await codeApi.getNodeCode({
        project_id: projectId,
        node_id: nodeId,
        node_title: nodeTitle,
      });

      if (data.success && data.code) {
        setCode(data.code);
        if (editorRef.current) {
          editorRef.current.setValue(data.code);
        }
      }
    } catch (error) {
      console.error("Error fetching code:", error);
    } finally {
      setIsLoadingCode(false);
    }
  }, [projectId, nodeId, nodeTitle]);


  const handleSave = useCallback(async () => {
    if (!editorRef.current) return;

    setSaveModalOpen(true);
    setSaveStatus("loading");
    const currentCode = editorRef.current.getValue();

    try {
      const data = await codeApi.saveNodeCode({
        project_id: projectId,
        node_id: nodeId,
        node_title: nodeTitle,
        code: currentCode,
      });

      if (data.success) {
        setSaveStatus("success");
        setCode(currentCode);
        
        // Fetch updated metadata after saving
        try {
          // Use the actual file name from node data if available
          const fileName = nodeFile || `${nodeId}_${nodeTitle.replace(/\s+/g, '_')}.py`;
          const metadataResult = await codeApi.getNodeMetadata({
            project_id: projectId,
            node_id: nodeId,
            node_data: { data: { file: fileName } }
          });
          
          if (metadataResult.success && metadataResult.metadata) {            
            // Emit custom event to update node ports in the flow with slight delay
            setTimeout(() => {
              const updateEvent = new CustomEvent("updateNodePorts", {
                detail: {
                  nodeId: nodeId,
                  metadata: metadataResult.metadata,
                  timestamp: Date.now()
                },
                bubbles: true,
              });
              window.dispatchEvent(updateEvent);
            }, 100); // Small delay to ensure save is fully processed
          } else {
            console.warn("Failed to fetch metadata or metadata is empty:", metadataResult);
          }
        } catch (metadataError) {
          console.error("Error fetching metadata after save:", metadataError);
        }
        
        setTimeout(() => setSaveModalOpen(false), 1500);
      } else {
        setSaveStatus("error");
      }
    } catch (error) {
      setSaveStatus("error");
      console.error("Error saving code:", error);
    }
  }, [projectId, nodeId, nodeTitle, nodeFile]);

  const handleRunCode = useCallback(async () => {
    if (!editorRef.current) return;

    setRunModalOpen(true);
    setRunStatus("loading");
    setRunResult("");

    const currentCode = editorRef.current.getValue();

    try {
      // First save the code
      await codeApi.saveNodeCode({
        project_id: projectId,
        node_id: nodeId,
        node_title: nodeTitle,
        code: currentCode,
      });

      // Then execute it
      const result = await codeApi.executeNode({
        project_id: projectId,
        node_id: nodeId,
      });

      if (result.success) {
        setRunStatus("success");
        setRunResult(JSON.stringify(result.output, null, 2));
      } else {
        setRunStatus("error");
        setRunResult(result.error || "Execution failed");
      }
    } catch (error) {
      setRunStatus("error");
      setRunResult(error instanceof Error ? error.message : "Unknown error");
    }
  }, [projectId, nodeId, nodeTitle]);

  const handleOpenSaveComponent = useCallback(() => {
    setComponentName(nodeTitle);
    setComponentDescription("");
    setComponentError(null);
    setIsSaveComponentModalOpen(true);
  }, [nodeTitle]);

  const handleCloseSaveComponent = useCallback(() => {
    if (isSavingComponent) return;
    setIsSaveComponentModalOpen(false);
  }, [isSavingComponent]);

  const handleSaveComponent = useCallback(async () => {
    if (!editorRef.current) return;

    const trimmedName = componentName.trim();
    const currentCode = editorRef.current.getValue();

    if (!trimmedName) {
      setComponentError("컴포넌트 이름을 입력해주세요.");
      return;
    }

    if (!currentCode || currentCode.trim().length === 0) {
      setComponentError("저장할 코드가 없습니다.");
      return;
    }

    const normalizeName = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();

    setIsSavingComponent(true);
    setComponentError(null);

    try {
      const existingComponents = await userComponentApi.listUserComponents();
      const normalizedNewName = normalizeName(trimmedName);
      const hasDuplicate = existingComponents.some(
        (component) => normalizeName(component.name) === normalizedNewName
      );

      if (hasDuplicate) {
        setComponentError("이미 동일한 이름의 사용자 컴포넌트가 존재합니다.");
        setIsSavingComponent(false);
        return;
      }

      let componentMetadata: UserComponentMetadataDetail | undefined;

      try {
        const fileName = nodeFile || `${nodeId}_${nodeTitle.replace(/\s+/g, '_')}.py`;
        const metadataResult = await codeApi.getNodeMetadata({
          project_id: projectId,
          node_id: nodeId,
          node_data: {
            data: {
              file: fileName,
            },
          },
        });

        if (metadataResult.success && isMetadata(metadataResult.metadata)) {
          const mapPorts = (ports?: MetadataPort[]) =>
            ports
              ?.filter((port) => typeof port === "object" && port !== null && typeof port.name === "string" && typeof port.type === "string")
              .map((port) => ({
                name: port.name,
                type: port.type,
                required: port.required,
                default: port.default,
              }));

          componentMetadata = {
            inputs: mapPorts(metadataResult.metadata.inputs),
            outputs: mapPorts(metadataResult.metadata.outputs),
          };
        }
      } catch (metadataError) {
        console.error("Failed to compute metadata for user component:", metadataError);
      }

      await userComponentApi.createUserComponent({
        name: trimmedName,
        description: componentDescription.trim() || undefined,
        code: currentCode,
        project_id: projectId,
        metadata: componentMetadata,
      });

      setIsSavingComponent(false);
      setIsSaveComponentModalOpen(false);
      setToastMessage(`'${trimmedName}' 사용자 컴포넌트를 저장했습니다.`);
      window.dispatchEvent(new Event("userComponentsUpdated"));
    } catch (error) {
      let message = "사용자 컴포넌트를 저장하지 못했습니다.";
      if (error instanceof ApiError) {
        message = error.message;
      } else if (error instanceof Error) {
        message = error.message;
      }
      setComponentError(message);
      setIsSavingComponent(false);
    }
  }, [componentDescription, componentName, projectId, nodeFile, nodeId, nodeTitle, setToastMessage]);

  // Fetch code when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchCode();
    }
  }, [isOpen, nodeId, fetchCode]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  // Ctrl+S / Cmd+S save shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+S (Windows/Linux) or Cmd+S (Mac)
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault(); // Prevent browser's default save dialog
        handleSave();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, handleSave]);

  const handleEditorDidMount = useCallback(
    (editor: editor.IStandaloneCodeEditor, monaco: typeof Monaco) => {
      editorRef.current = editor;

      // Only set the code if we have it loaded (not loading)
      if (!isLoadingCode && code) {
        editor.setValue(code);
      }

      // Configure editor options
      editor.updateOptions({
        automaticLayout: true,
        minimap: { enabled: true },
        scrollBeyondLastLine: false,
        fontSize: 14,
        lineNumbers: "on",
        roundedSelection: false,
        cursorStyle: "line",
        glyphMargin: true,
        quickSuggestions: {
          other: true,
          comments: false,
          strings: false,
        },
        wordBasedSuggestions: "currentDocument",
        suggestOnTriggerCharacters: true,
        parameterHints: {
          enabled: true,
        },
        suggest: {
          snippetsPreventQuickSuggestions: false,
          showMethods: true,
          showFunctions: true,
          showVariables: true,
          showClasses: true,
          showModules: true,
          showKeywords: true,
          showSnippets: true,
          insertMode: "replace",
        },
        tabSize: 4,
        insertSpaces: true,
        formatOnType: true,
        formatOnPaste: true,
        autoIndent: "full",
        folding: true,
        foldingStrategy: "indentation",
      });

      // Add Python-specific keybindings
      editor.addAction({
        id: "python-run-code",
        label: "Run Python Code",
        keybindings: [monaco.KeyCode.F5],
        contextMenuGroupId: "navigation",
        contextMenuOrder: 1.5,
        run: () => {
          handleRunCode();
        },
      });
    },
    [code, isLoadingCode, handleRunCode]
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-[9990] backdrop-blur-lg bg-black/50 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-neutral-950 rounded-lg shadow-2xl w-11/12 max-w-6xl h-5/6 flex flex-col animate-scaleIn relative"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-4 border-b border-neutral-700">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              Python IDE - {nodeTitle}
              {isLoadingCode && (
                <span className="text-sm text-neutral-400">(Loading...)</span>
              )}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenSaveComponent}
              className="px-3 py-1.5 bg-neutral-900 border border-neutral-700 text-white rounded hover:bg-neutral-800 hover:border-red-500 transition-colors text-sm flex items-center gap-2"
              title="Save as User Component"
            >
              <span>🧩</span>
              <span>Save Component</span>
            </button>
            <X onClose={onClose} />
          </div>
        </div>

        <div className="flex-1 p-4 bg-neutral-900">
          {isLoadingCode ? (
            <div className="flex items-center justify-center h-full">
              <span className="text-neutral-400">Loading code...</span>
            </div>
          ) : (
            <Editor
              height="100%"
              defaultLanguage="python"
              defaultValue={code}
              theme="vs-dark"
              onMount={handleEditorDidMount}
              options={{
                automaticLayout: true,
                minimap: { enabled: true },
                fontSize: 14,
                readOnly: false,
              }}
            />
          )}
        </div>

        <div className="p-4 border-t border-neutral-700 flex justify-between">
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors flex items-center gap-2"
            >
              Save
            </button>
            <button
              onClick={handleRunCode}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <span>▶️</span>
              Run
            </button>
            <SimpleExportButton
              code={editorRef.current?.getValue() || code}
              fileName={`${nodeId}_${nodeTitle.replace(/\s+/g, "_")}.py`}
            />
          </div>
        </div>

        {isSaveComponentModalOpen && (
          <div
            className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70"
            onClick={handleCloseSaveComponent}
          >
            <div
              className="bg-neutral-950 border border-neutral-700 rounded-lg shadow-xl w-full max-w-md p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-white mb-4">
                Save as User Component
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-neutral-300 mb-1" htmlFor="user-component-name">
                    Component Name
                  </label>
                  <input
                    id="user-component-name"
                    value={componentName}
                    onChange={(e) => setComponentName(e.target.value)}
                    className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded text-white focus:outline-none focus:border-red-500"
                    placeholder="Enter component name"
                    maxLength={100}
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm text-neutral-300 mb-1" htmlFor="user-component-description">
                    Description (optional)
                  </label>
                  <textarea
                    id="user-component-description"
                    value={componentDescription}
                    onChange={(e) => setComponentDescription(e.target.value)}
                    className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded text-white focus:outline-none focus:border-red-500"
                    placeholder="Briefly describe this component"
                    rows={3}
                    maxLength={500}
                  />
                </div>
                {componentError && (
                  <div className="text-red-500 text-sm">
                    {componentError}
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button
                  onClick={handleCloseSaveComponent}
                  className="px-3 py-1.5 text-sm text-neutral-300 border border-neutral-700 rounded hover:text-white hover:border-neutral-500 transition-colors"
                  disabled={isSavingComponent}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveComponent}
                  className="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-500 transition-colors disabled:opacity-60"
                  disabled={isSavingComponent}
                >
                  {isSavingComponent ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Save Modal */}
        <LoadingModal
          isOpen={saveModalOpen}
          status={saveStatus}
          notice={{
            loading: "Saving code...",
            success: "Code saved successfully!",
            error: "Failed to save code",
          }}
          onClose={() => setSaveModalOpen(false)}
        />

        {/* Run Modal */}
        <LoadingModal
          isOpen={runModalOpen}
          status={runStatus}
          notice={{
            loading: "Executing code...",
            success: "Execution completed!",
            error: "Execution failed",
            errorDetails: runStatus === "error" ? runResult : undefined,
          }}
          onClose={() => setRunModalOpen(false)}
        />
      </div>
    </div>
  );
};

export default IdeModal;
