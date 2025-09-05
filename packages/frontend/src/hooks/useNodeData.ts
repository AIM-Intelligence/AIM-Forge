import { useState, useEffect, useRef, useCallback } from 'react';
import { projectApi } from '../utils/api';

/**
 * Options for useNodeData hook
 */
interface UseNodeDataOptions<T> {
  projectId: string | undefined;
  nodeId: string;
  storageKey: string;
  defaultValue: T;
  serverData?: any; // Initial data from server (props.data)
  debounceMs?: number;
  onSaveSuccess?: () => void;
  onSaveError?: (error: Error) => void;
}

/**
 * Return type for useNodeData hook
 */
interface UseNodeDataReturn<T> {
  data: T;
  setData: (value: T | ((prev: T) => T)) => void;
  isLoading: boolean;
  isSaving: boolean;
  error: Error | null;
  forceSync: () => Promise<void>; // Manual sync trigger
}

/**
 * Custom hook for unified node data management
 * - Server as single source of truth
 * - localStorage as cache/fallback
 * - Automatic synchronization
 */
export function useNodeData<T extends Record<string, any>>(
  options: UseNodeDataOptions<T>
): UseNodeDataReturn<T> {
  const {
    projectId,
    nodeId,
    storageKey,
    defaultValue,
    serverData,
    debounceMs = 500,
    onSaveSuccess,
    onSaveError,
  } = options;

  // State management
  const [data, setDataInternal] = useState<T>(defaultValue);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  // Refs for debouncing and tracking
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialMount = useRef(true);
  const lastSavedData = useRef<T>(defaultValue);

  /**
   * Load data from localStorage (cache)
   */
  const loadFromLocalStorage = useCallback((): T | null => {
    if (!projectId) return null;
    
    try {
      const stored = localStorage.getItem(`${storageKey}_${projectId}_${nodeId}`);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load from localStorage:', error);
    }
    return null;
  }, [projectId, nodeId, storageKey]);

  /**
   * Save data to localStorage
   */
  const saveToLocalStorage = useCallback((value: T) => {
    if (!projectId) return;
    
    try {
      localStorage.setItem(
        `${storageKey}_${projectId}_${nodeId}`,
        JSON.stringify(value)
      );
    } catch (error) {
      console.error('Failed to save to localStorage:', error);
    }
  }, [projectId, nodeId, storageKey]);

  /**
   * Save data to server
   */
  const saveToServer = useCallback(async (value: T) => {
    if (!projectId) return;
    
    setIsSaving(true);
    setError(null);
    
    try {
      await projectApi.updateNodeMetadata({
        project_id: projectId,
        node_id: nodeId,
        metadata: value,
      });
      
      lastSavedData.current = value;
      onSaveSuccess?.();
    } catch (error) {
      const err = error as Error;
      setError(err);
      console.error('Failed to save to server:', err);
      
      // Keep localStorage as fallback
      saveToLocalStorage(value);
      onSaveError?.(err);
    } finally {
      setIsSaving(false);
    }
  }, [projectId, nodeId, saveToLocalStorage, onSaveSuccess, onSaveError]);

  /**
   * Load initial data on mount
   */
  useEffect(() => {
    if (!projectId) return;
    
    setIsLoading(true);
    
    // Step 1: Load from localStorage for immediate display
    const cachedData = loadFromLocalStorage();
    if (cachedData) {
      setDataInternal(cachedData);
    }
    
    // Step 2: Check server data from props
    if (serverData) {
      // Extract relevant metadata from serverData
      const serverMetadata: Partial<T> = {};
      
      // Extract known metadata fields
      const metadataFields = [
        'dimensions', 'content', 'value', 'fontSize', 'isBold',
        'text', 'color', 'backgroundColor', 'borderColor'
      ];
      
      metadataFields.forEach(field => {
        if (serverData[field] !== undefined) {
          (serverMetadata as any)[field] = serverData[field];
        }
      });
      
      // If server has actual data (not just default values)
      const hasServerData = Object.keys(serverMetadata).some(key => {
        const value = (serverMetadata as any)[key];
        // Check if value is meaningful (not empty string, not default)
        return value !== '' && value !== undefined && value !== null &&
               !(typeof value === 'object' && Object.keys(value).length === 0);
      });
      
      if (hasServerData) {
        const mergedData = { ...defaultValue, ...serverMetadata } as T;
        setDataInternal(mergedData);
        saveToLocalStorage(mergedData); // Update cache
        lastSavedData.current = mergedData;
      } else if (!cachedData) {
        // No server data and no cache, use default
        setDataInternal(defaultValue);
      }
    }
    
    setIsLoading(false);
    isInitialMount.current = false;
  }, [projectId, nodeId, serverData]); // Removed dependencies that could cause loops

  /**
   * Public setData function with debounced server save
   */
  const setData = useCallback((value: T | ((prev: T) => T)) => {
    setDataInternal(prevData => {
      const newData = typeof value === 'function' ? value(prevData) : value;
      
      // Always save to localStorage immediately (cache)
      saveToLocalStorage(newData);
      
      // Skip server save on initial mount to prevent overwriting
      if (isInitialMount.current) {
        return newData;
      }
      
      // Debounce server save
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      
      saveTimeoutRef.current = setTimeout(() => {
        saveToServer(newData);
      }, debounceMs);
      
      return newData;
    });
  }, [saveToLocalStorage, saveToServer, debounceMs]);

  /**
   * Force sync with server (manual trigger)
   */
  const forceSync = useCallback(async () => {
    if (!projectId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      // For now, just save current data to server
      // In future, could fetch from server and merge
      await saveToServer(data);
    } catch (error) {
      setError(error as Error);
    } finally {
      setIsLoading(false);
    }
  }, [projectId, data, saveToServer]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  /**
   * Remove localStorage on node deletion
   */
  useEffect(() => {
    const handleDeleteNode = (event: CustomEvent) => {
      if (event.detail.id === nodeId && projectId) {
        localStorage.removeItem(`${storageKey}_${projectId}_${nodeId}`);
      }
    };

    window.addEventListener('deleteNode' as any, handleDeleteNode);
    return () => {
      window.removeEventListener('deleteNode' as any, handleDeleteNode);
    };
  }, [projectId, nodeId, storageKey]);

  return {
    data,
    setData,
    isLoading,
    isSaving,
    error,
    forceSync,
  };
}